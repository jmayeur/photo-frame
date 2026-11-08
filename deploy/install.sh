#!/bin/bash
# Reproducible install for a fresh Raspberry Pi OS Lite (64-bit).
# Run from the repo checkout:  bash deploy/install.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$HOME"
export PHOTO_FRAME_DIR="$APP_DIR"

echo "==> Installing photo-frame from $APP_DIR for user $USER"

# 1. System packages
echo "==> Installing system packages (fbi, imagemagick, nfs-common, rsync)"
sudo apt-get update
sudo apt-get install -y fbi imagemagick nfs-common rsync

# 2. Node dependencies
echo "==> Installing Node dependencies"
cd "$APP_DIR"
npm install --omit=dev

# 3. Per-host config
if [ ! -f "$APP_DIR/config.json" ]; then
  cp "$APP_DIR/config.example.json" "$APP_DIR/config.json"
  echo "==> Created config.json — EDIT IT for this host (user, paths, panel size)."
fi

# 4. Home-dir scripts referenced by cron + the login hook
echo "==> Installing scripts into $HOME_DIR"
install -m 755 "$APP_DIR/deploy/frame.sh"       "$HOME_DIR/frame.sh"
install -m 755 "$APP_DIR/deploy/stopfbi.sh"     "$HOME_DIR/stopfbi.sh"
install -m 755 "$APP_DIR/deploy/refreshDay.sh"  "$HOME_DIR/refreshDay.sh"
install -m 755 "$APP_DIR/deploy/scanAllDirs.sh" "$HOME_DIR/scanAllDirs.sh"
install -m 755 "$APP_DIR/deploy/sleep.sh"       "$HOME_DIR/sleep.sh"
install -m 755 "$APP_DIR/deploy/wake.sh"        "$HOME_DIR/wake.sh"
install -m 755 "$APP_DIR/deploy/sync.sh"        "$HOME_DIR/sync.sh"
mkdir -p "$HOME_DIR/logs" "$APP_DIR/data"

# Render the shell env (fbi options + playlist + optional client source) from
# config.json, so frame.sh/sync.sh stay generic. Re-run after editing config:
#   npm run frame-env > ~/.frame.env
node "$APP_DIR/src/frame_env.js" > "$HOME_DIR/.frame.env"
echo "   wrote $HOME_DIR/.frame.env"

# 4b. Display: fbi on full-KMS /dev/fb0 needs a real login session that owns
# tty1 (a systemd service can't provide it — fbi exits immediately). So we
# autologin on tty1 and launch the slideshow from the login shell.
echo "==> Configuring tty1 autologin + slideshow launcher"
sudo usermod -aG video "$USER"
# retire any earlier systemd-service approach if present
sudo systemctl disable --now photos.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/photos.service
# getty autologin drop-in (user substituted in)
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
printf '[Service]\nExecStart=\nExecStart=-/sbin/agetty --autologin %s --noclear %%I $TERM\n' "$USER" \
  | sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable getty@tty1
# launch hook in the login shell, only on tty1 (idempotent)
HOOK="$HOME_DIR/.bash_profile"
if ! grep -q 'frame.sh' "$HOOK" 2>/dev/null; then
  printf '\n# photo-frame: run the slideshow on the tty1 console login\n[ "$(tty)" = /dev/tty1 ] && ~/frame.sh\n' >> "$HOOK"
fi

# 4c. Passwordless sudo for fbi, pkill, and the panel blank write.
# frame.sh runs `sudo fbi`; the refresh/sleep/stop scripts `sudo pkill fbi`;
# sleep.sh/wake.sh `sudo tee /sys/class/graphics/fb0/blank`. cron runs these
# headlessly, so scope NOPASSWD to exactly these commands.
echo "==> Granting scoped passwordless sudo (fbi, pkill, panel blank)"
FBI_BIN="$(command -v fbi || echo /usr/bin/fbi)"
PKILL_BIN="$(command -v pkill || echo /usr/bin/pkill)"
TEE_BIN="$(command -v tee || echo /usr/bin/tee)"
SUDOERS_TMP="$(mktemp)"
printf '%s ALL=(ALL) NOPASSWD: %s, %s, %s /sys/class/graphics/fb0/blank\n' \
  "$USER" "$FBI_BIN" "$PKILL_BIN" "$TEE_BIN" > "$SUDOERS_TMP"
if sudo visudo -cf "$SUDOERS_TMP" >/dev/null; then
  sudo install -m 0440 -o root -g root "$SUDOERS_TMP" /etc/sudoers.d/photo-frame
  echo "   installed /etc/sudoers.d/photo-frame"
else
  echo "   !! sudoers validation failed; not installing." >&2
fi
rm -f "$SUDOERS_TMP"

# 5. Automatic security updates (replaces the old weekly dist-upgrade cron)
echo "==> Configuring unattended-upgrades (security only, auto-reboot 03:30)"
sudo apt-get install -y unattended-upgrades
sudo cp "$APP_DIR/deploy/apt/20auto-upgrades" /etc/apt/apt.conf.d/20auto-upgrades
sudo cp "$APP_DIR/deploy/apt/51unattended-upgrades-photo-frame" \
    /etc/apt/apt.conf.d/51unattended-upgrades-photo-frame

# 6. Database
echo "==> Initializing database (no-op if it already exists)"
node "$APP_DIR/src/dbmanager/init_db.js" 2>/dev/null || echo "   (db already initialized)"

echo
if [ -n "$(node -e "process.stdout.write(((require('$APP_DIR/src/config').source)||{}).host||'')" 2>/dev/null)" ]; then
  echo "==> Done (CLIENT frame — pulls from the primary, no NAS scan). Next steps:"
  echo "    1. Key-based SSH to the primary:  ssh-keygen -t ed25519 ; ssh-copy-id <user>@<primary-ip>"
  echo "    2. First pull:             $HOME_DIR/sync.sh"
  echo "    3. Install the schedule:   crontab $APP_DIR/deploy/crontab.client"
  echo "    4. Reboot — the frame auto-logs-in on tty1 and starts the slideshow."
else
  echo "==> Done (PRIMARY frame). Next steps:"
  echo "    1. Mount the NAS at the photosDir from config.json (see README: /etc/fstab)."
  echo "    2. Install the schedule:   crontab $APP_DIR/deploy/crontab"
  echo "    3. First scan:             node $APP_DIR/src/photoscanner/scanAllDirs.js"
  echo "    4. Build today's playlist: $HOME_DIR/refreshDay.sh"
  echo "    5. Reboot — the frame auto-logs-in on tty1 and starts the slideshow."
fi
