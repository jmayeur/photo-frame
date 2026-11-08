#!/bin/bash
# Full recursive scan of the NAS photo folders into the SQLite index.
APP_DIR="${PHOTO_FRAME_DIR:-/home/pi/filescanner}"
node "$APP_DIR/src/photoscanner/scanAllDirs.js"
