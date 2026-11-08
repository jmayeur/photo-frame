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
   fbi -d /dev/fb0  (full-screen slideshow, 30s/photo)
```

Scheduling lives in `deploy/crontab`:

| When          | Job                     | Purpose                              |
| ------------- | ----------------------- | ------------------------------------ |
| 22:30 daily   | `vcgencmd display_power 0` | Blank the HDMI display at night   |
| 07:00 daily   | `vcgencmd display_power 1` | Wake the display                  |
| 07:15 daily   | `refreshDay.sh`         | Rebuild today's playlist, restart fbi |
| 1st of month  | `scanAllDirs.sh`        | Full NAS rescan                      |
| ~03:30 (as needed) | `unattended-upgrades` | Security updates + reboot (not cron) |

## Layout

```
config.example.json   Per-host settings (copy to config.json; git-ignored)
src/
  config.js           Loads config.json / config.example.json
  photoscanner/       Scan NAS, build daily playlist, restart fbi
  dbmanager/          SQLite index (init, insert, query)
deploy/
  photos.service      systemd unit that launches fbi on boot
  crontab             The schedule above
  photo.sh/stopfbi.sh fbi start/stop
  refreshDay.sh       Wrapper: rebuild today's playlist
  scanAllDirs.sh      Wrapper: full rescan
  auto-update.sh      Weekly OS update (see note in file)
  install.sh          Reproducible install
data/                 Generated SQLite db (git-ignored)
```

## Configuration

All host-specific paths live in `config.json` (copied from
`config.example.json`). No code hard-codes `/home/pi` — a reimage onto a
different user or host only needs this file edited. Override the location with
`PHOTO_FRAME_CONFIG=/path/to/config.json`.

## Install (fresh Raspberry Pi OS Lite, 64-bit)

```bash
git clone <this repo> ~/filescanner
cd ~/filescanner
bash deploy/install.sh        # system + node deps, scripts, service, db
# then follow the printed steps: mount NAS, install crontab, first scan
```

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
   192.168.119.136:/volume1/Photos  /home/<user>/Photos  nfs  rw,hard,vers=3  0  0
   ```
4. `bash deploy/install.sh`, then the printed steps.
5. **Validate before swapping cards (64-bit display-stack changes):**
   - [ ] `fbi -d /dev/fb0 -T 1 ...` actually renders on the HDMI panel.
         Trixie/Bookworm use full KMS (vc4-kms-v3d), not the buster `fkms`
         driver; `/dev/fb0` is DRM fbdev emulation and may need `console=tty1`
         / a disabled getty on tty1.
   - [ ] Nightly blanking works. `vcgencmd display_power 0/1` is legacy and may
         not blank HDMI under KMS — fall back to `wlr-randr`, `xset`, or
         CEC (`cec-ctl`/`echo 'standby 0' | cec-client`) if so.
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
