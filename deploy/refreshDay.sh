#!/bin/bash
# Rebuild today's "on this day" playlist and restart the frame.
# Optional arg 1: an override date (e.g. "2024-12-25") for testing.
APP_DIR="${PHOTO_FRAME_DIR:-/home/pi/filescanner}"
node "$APP_DIR/src/photoscanner/process_daily_file.js" "${@:1:1}"
