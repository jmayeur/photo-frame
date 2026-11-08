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
install -m 755 "$APP_DIR/deploy/auto-update.sh" "$HOME_DIR/auto-update.sh"
mkdir -p "$HOME_DIR/logs" "$APP_DIR/data"

# 5. systemd service
echo "==> Installing systemd service"
sudo cp "$APP_DIR/deploy/photos.service" /etc/systemd/system/photos.service
sudo systemctl daemon-reload
sudo systemctl enable photos.service

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
