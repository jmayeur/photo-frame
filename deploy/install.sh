#!/bin/bash
# Reproducible install for a fresh Raspberry Pi OS (Bookworm Lite, 64-bit).
# Run from the repo checkout:  bash deploy/install.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$HOME"
export PHOTO_FRAME_DIR="$APP_DIR"

echo "==> Installing photo-frame from $APP_DIR for user $USER"

# 1. System packages
echo "==> Installing system packages (fbi, imagemagick, nfs-common)"
sudo apt-get update
sudo apt-get install -y fbi imagemagick nfs-common

# 2. Node dependencies
echo "==> Installing Node dependencies"
cd "$APP_DIR"
npm install --omit=dev

# 3. Per-host config
if [ ! -f "$APP_DIR/config.json" ]; then
  cp "$APP_DIR/config.example.json" "$APP_DIR/config.json"
  echo "==> Created config.json — EDIT IT for this host (user, paths, panel size)."
fi

# 4. Home-dir scripts referenced by cron + the systemd service
echo "==> Installing scripts into $HOME_DIR"
install -m 755 "$APP_DIR/deploy/photo.sh"       "$HOME_DIR/photo.sh"
install -m 755 "$APP_DIR/deploy/stopfbi.sh"     "$HOME_DIR/stopfbi.sh"
install -m 755 "$APP_DIR/deploy/refreshDay.sh"  "$HOME_DIR/refreshDay.sh"
install -m 755 "$APP_DIR/deploy/scanAllDirs.sh" "$HOME_DIR/scanAllDirs.sh"
mkdir -p "$HOME_DIR/logs" "$APP_DIR/data"

# 4b. Passwordless sudo for fbi + pkill.
# photo.sh/stopfbi.sh call `sudo fbi` and `sudo pkill fbi` (fbi needs root for
# /dev/fb0 and the VT switch). cron runs the daily refresh headlessly, so a
# sudo password prompt would hang/fail. On old Raspbian the `pi` user had
# blanket NOPASSWD by default; a fresh 64-bit install does not, so scope it to
# exactly these two commands.
echo "==> Granting passwordless sudo for fbi/pkill (cron restarts the frame headlessly)"
FBI_BIN="$(command -v fbi || echo /usr/bin/fbi)"
PKILL_BIN="$(command -v pkill || echo /usr/bin/pkill)"
SUDOERS_TMP="$(mktemp)"
printf '%s ALL=(ALL) NOPASSWD: %s, %s\n' "$USER" "$FBI_BIN" "$PKILL_BIN" > "$SUDOERS_TMP"
if sudo visudo -cf "$SUDOERS_TMP" >/dev/null; then
  sudo install -m 0440 -o root -g root "$SUDOERS_TMP" /etc/sudoers.d/photo-frame
  echo "   installed /etc/sudoers.d/photo-frame"
else
  echo "   !! sudoers validation failed; not installing. Check fbi/pkill paths." >&2
fi
rm -f "$SUDOERS_TMP"

# 5. systemd service
echo "==> Installing systemd service"
sudo cp "$APP_DIR/deploy/photos.service" /etc/systemd/system/photos.service
sudo systemctl daemon-reload
sudo systemctl enable photos.service

# 5b. Automatic security updates (replaces the old weekly dist-upgrade cron)
echo "==> Configuring unattended-upgrades (security only, auto-reboot 03:30)"
sudo apt-get install -y unattended-upgrades
sudo cp "$APP_DIR/deploy/apt/20auto-upgrades" /etc/apt/apt.conf.d/20auto-upgrades
sudo cp "$APP_DIR/deploy/apt/51unattended-upgrades-photo-frame" \
    /etc/apt/apt.conf.d/51unattended-upgrades-photo-frame

# 6. Database
echo "==> Initializing database (no-op if it already exists)"
node "$APP_DIR/src/dbmanager/init_db.js" 2>/dev/null || echo "   (db already initialized)"

echo
echo "==> Done. Next steps:"
echo "    1. Mount the NAS at the photosDir from config.json (see README: /etc/fstab)."
echo "    2. Install the schedule:   crontab $APP_DIR/deploy/crontab"
echo "    3. First scan:             node $APP_DIR/src/photoscanner/scanAllDirs.js"
echo "    4. Build today's playlist: $HOME_DIR/refreshDay.sh"
echo "    5. Start the frame:        sudo systemctl start photos.service"
