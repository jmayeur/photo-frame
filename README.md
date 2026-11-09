# Photo Frame

An "on this day" digital photo frame for a Raspberry Pi driving a local HDMI
LCD. A SQLite index of photos on a NAS is scanned periodically; each morning the
photos taken on today's month/day (across all years) are written to a playlist
and displayed full-screen with [`fbi`](https://manpages.debian.org/fbi).

## How it works

```
NAS (Synology, NFS)  ──mounted at──>  <photosDir>
        │
        │  monthly: scanAllDirs.js  (recursive walk → SQLite index)
        ▼
   data/photofiles.db   (photos keyed by month/day/year)
        │
        │  daily 07:15: process_daily_file.js
        │    → ImageMagick: EXIF-rotate, HEIC→JPEG, letterbox to panel (cached)
        ▼
   files.txt  (today's display-ready photos, in cacheDir)
        │
        ▼
   frame.sh → fbi  (full-screen slideshow on tty1, 30s/photo)
```

The slideshow runs from **`frame.sh`**, launched by a `~/.bash_profile` hook on
the **tty1 autologin** session — not a systemd service. See
[Display: why autologin](#display-why-autologin) for why that's necessary on
64-bit (full-KMS) Raspberry Pi OS.

Scheduling lives in `deploy/crontab`:

| When          | Job                     | Purpose                              |
| ------------- | ----------------------- | ------------------------------------ |
| 22:30 daily   | `sleep.sh`              | Power the panel off at night (KMS DPMS) |
| 07:00 daily   | `wake.sh`               | Power the panel back on              |
| 07:15 daily   | `refreshDay.sh`         | Rebuild today's playlist, restart fbi |
| 1st of month  | `scanAllDirs.sh`        | Full NAS rescan                      |
| ~03:30 (as needed) | `unattended-upgrades` | Security updates + reboot (not cron) |

Nightly blanking uses `echo 4 > /sys/class/graphics/fb0/blank` (framebuffer
DPMS power-down), **not** `vcgencmd display_power` — the latter returns `-1` and
does nothing under the full-KMS (`vc4-kms-v3d`) driver on 64-bit Raspberry Pi
OS. The framebuffer is preserved while off, so the last photo reappears on wake.

## Layout

```
config.example.json   Per-host settings (copy to config.json; git-ignored)
src/
  config.js           Loads config.json / config.example.json
  frame_env.js        Renders fbi options + source into ~/.frame.env (shell)
  photoscanner/       Scan NAS, build daily playlist, restart fbi
  dbmanager/          SQLite index (init, insert, query)
deploy/
  frame.sh            Slideshow loop (runs on the tty1 autologin session)
  getty-autologin.conf  tty1 autologin drop-in (reference; install.sh applies it)
  crontab             Primary schedule (scan + daily refresh + blank/wake)
  crontab.client      Client schedule (pull from primary + blank/wake)
  sync.sh             Client: rsync the primary's playlist + cache
  stopfbi.sh          Pause the slideshow
  sleep.sh/wake.sh    Nightly panel power-down / power-up (KMS DPMS)
  refreshDay.sh       Wrapper: rebuild today's playlist
  scanAllDirs.sh      Wrapper: full rescan
  auto-update.sh      Weekly OS update (see note in file)
  install.sh          Reproducible install
data/                 Generated SQLite db (git-ignored)
```

## Configuration

Copy the template and edit it for your setup — nothing host-specific is
committed:

```bash
cp config.example.json config.json
```

Key fields:

- `photosDir` — where your library is mounted (e.g. the NAS mount point).
- `photoFolders` — the subfolders under `photosDir` to scan (the example names
  are placeholders; replace with your own).
- `panel` — your display's resolution (images are letterboxed to this).
- `imagemagick.bin` — `convert` on ImageMagick 6, `magick` on 7.
- `imagemagick.concurrency` — how many conversions run at once (default 2). Each
  12 MP HEIC decode needs a few hundred MB; set this to `1` on a 1 GB Pi 3,
  especially when building a 1920×1080 cache, or a mass rebuild can OOM the box.
- `scan.iphoneFolderMatch` — any folder whose path contains this string uses the
  larger `iphoneMinBytes` floor (phone photos tend to be bigger).
- `fbi.verbose` — `true` shows the filename overlay (`-v`); `false` hides it
  (`--noverbose`). Also `fbi.tty`, `fbi.intervalSec`, `fbi.device`.
- `source` — leave `null` for a normal (primary) frame. Set it to make this a
  display-only **client** that pulls another frame's playlist + cache instead of
  scanning the NAS — see [A second frame](#a-second-frame-primary--client).

fbi options are rendered from config into `~/.frame.env` at install; after
editing `config.json`, regenerate with `node src/frame_env.js > ~/.frame.env`.

`config.json` is git-ignored. No code hard-codes `/home/pi`, so a different user
or host only needs this file edited. Override its location with
`PHOTO_FRAME_CONFIG=/path/to/config.json`.

## Finding the original photo

fbi displays pre-processed copies from `cacheDir`, not the NAS originals, so the
on-screen filename overlay (`fbi -v`) shows a cache name. Each cache file keeps
the original basename as a prefix (e.g. `2010-08-11_11.57.12__a1b2c3d4e5f6.jpg`)
so it's recognizable, and each daily build writes `cacheDir/manifest.tsv`
mapping the cache name to the full original path. To get the exact NAS path for
anything in the current rotation:

```bash
npm run whereis -- <part of the on-screen name>   # e.g. 2010-08-11
```

The cache is pruned to the current day's set on every build, so it stays about
one day's worth of images rather than growing toward the whole library.

## A second frame (primary + client)

A second frame can display the same "on this day" photos **without re-scanning
the NAS** by pulling the primary's already-prepared `files.txt` + `cache/`. The
primary (the one with the NAS mount) does all the work; the client just syncs
and shows.

On the **client**, set `source` in `config.json` (and usually `fbi.verbose` to
taste), e.g. a frame pulling from `192.168.119.7` with no on-image filename:

```json
"fbi": { "device": "/dev/fb0", "tty": 1, "intervalSec": 30, "verbose": false },
"source": { "host": "192.168.119.7", "user": "pi" }
```

Then on the client:

```bash
bash deploy/install.sh                 # detects `source`, sets up display + sync.sh
ssh-keygen -t ed25519                   # key-based SSH to the primary (for rsync)
ssh-copy-id pi@192.168.119.7
~/sync.sh                               # first pull: cache/ + files.txt
crontab deploy/crontab.client           # pull 07:20 daily + nightly blank/wake
sudo reboot
```

`sync.sh` rsyncs the primary's `cache/` (mirrored, `--delete`) and `files.txt`,
then nudges fbi to reload. The client's `cacheDir` must match the primary's
cache path (both default to `/home/pi/cache`) so the paths inside `files.txt`
resolve. Panels needn't match resolution — fbi's `-a` autozoom scales the shared
cache to each panel.

**Sharpness across different-size panels:** the shared cache is built at the
**primary's** `panel` size, so set the primary's `panel` to the *largest*
consumer's resolution (e.g. `1920×1080` if a client is 1080p and the primary is
1366×768). Downscaling on the smaller panel stays crisp; upscaling a smaller
cache onto a larger panel would look soft. The cache key includes the panel
size, so after changing `panel`, the next `refreshDay.sh` rebuilds at the new
resolution.

## Install (fresh Raspberry Pi OS Lite, 64-bit)

```bash
git clone <this repo> ~/filescanner
cd ~/filescanner
bash deploy/install.sh        # system + node deps, scripts, tty1 autologin, db
# then follow the printed steps: mount NAS, install crontab, first scan, reboot
```

`install.sh` sets up the tty1 autologin, the `frame.sh` launch hook, and writes
`/etc/sudoers.d/photo-frame` granting the install user passwordless sudo for
**only** `fbi`, `pkill`, and writing the panel blank node. `frame.sh` runs
`sudo fbi`; the refresh/sleep scripts `sudo pkill fbi`; and the cron jobs run
headless, so a password prompt would hang. Old Raspbian gave the `pi` user
blanket NOPASSWD by default; a fresh 64-bit install does not, so this scopes it
narrowly.

## Display: why autologin

On 64-bit Raspberry Pi OS the display uses **full KMS** (`vc4-kms-v3d`), where
`/dev/fb0` is DRM *fbdev emulation*. fbi can only drive that from a process that
genuinely **owns tty1** — i.e. a real login session on that console. A systemd
service can't provide one: `sudo fbi` from a service spawns a PAM session that
loses tty1 and fbi exits right after loading its font, and a non-root fbi hits
`VT_ACTIVATE: Operation not permitted`. The reliable fix (what `install.sh` does)
is to **autologin the frame user on tty1** and launch `frame.sh` from the login
shell, which gives fbi exactly the console it needs.

`frame.sh` loops `sudo fbi … -l files.txt`; killing fbi (the daily refresh, or
`stopfbi.sh`) makes the loop relaunch it with the rebuilt playlist. A
`~/.frame-paused` flag lets `sleep.sh` hold the panel off overnight.

> Older frames on this network avoid all of this by running the **FKMS** driver
> (`dtoverlay=vc4-fkms-v3d`), where `/dev/fb0` is a real framebuffer and fbi runs
> happily from a plain service. FKMS was deprecated in Bookworm and may be gone
> in Trixie; if a future image still offers it, switching to FKMS would let you
> drop the autologin machinery entirely.

## Reimage runbook: buster (32-bit) → 64-bit

The Pi 3B is 64-bit-capable; the current OS (Raspbian 10 buster) is 32-bit and
end-of-life. The 32→64-bit change cannot be done in place — it requires a
reflash. Use a **spare SD card** so the running card stays as instant rollback.

Target OS (as of Nov 2026): **Raspberry Pi OS Lite (64-bit)**, currently based on
Debian 13 "Trixie". Bookworm is now the Legacy line; either works (both use full
KMS + ImageMagick 7). Flash with **Raspberry Pi Imager** (device: Raspberry Pi 3;
OS: Raspberry Pi OS Lite 64-bit), enabling SSH + user in its settings.

1. Flash to a spare card and boot it headless.
2. Create the same user layout (or edit `config.json` for a new username).
3. Mount the NAS. Example `/etc/fstab` line (NFSv3, Synology):
   ```
   <NAS_IP>:/volume1/Photos  /home/<user>/Photos  nfs  rw,hard,vers=3  0  0
   ```
4. `bash deploy/install.sh`, then the printed steps.
5. **Validate before swapping cards (64-bit display-stack changes):**
   - [ ] The slideshow comes up **on its own after a reboot** via the tty1
         autologin (not just interactively over SSH). Under full KMS fbi needs
         to own tty1 — see [Display: why autologin](#display-why-autologin). A
         systemd service does **not** work here; `install.sh` configures the
         autologin + `frame.sh` hook. Confirm with a real `sudo reboot`.
   - [ ] Nightly blanking works. `vcgencmd display_power` returns `-1` under
         full KMS (confirmed), so `sleep.sh`/`wake.sh` use the framebuffer DPMS
         node instead: `echo 4 | sudo tee /sys/class/graphics/fb0/blank` powers
         the panel down, `echo 0` restores it. (If a panel ignores DPMS, fall
         back to CEC: `cec-ctl --to 0 --standby`.)
   - [ ] HEIC renders. ImageMagick on Bookworm has the HEIF delegate; confirm
         with `convert -list format | grep -i heic`.
6. Swap the card once all three pass.

## ImageMagick note

On the current buster Pi (ImageMagick 6) the command is `convert` — the default
in `config.json` (`imagemagick.bin`). On the **64-bit reimage** (Trixie/Bookworm,
ImageMagick 7) `convert` is deprecated; set `imagemagick.bin` to `magick`.

## Known follow-ups (not yet applied)

- Replace `auto-update.sh`'s `dist-upgrade` with `unattended-upgrades` (security only).
- Content-based dedup (a moved/renamed file currently re-indexes as new).
