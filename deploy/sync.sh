#!/bin/bash
# Client mode: pull the primary frame's prepared playlist + cache instead of
# scanning the NAS. Requires key-based SSH from this frame's user to the primary
# (ssh-keygen here, ssh-copy-id to the primary — see README).
#
# The playlist (files.txt) references cache paths like /home/pi/cache/NAME.jpg,
# so the client's cacheDir must match the primary's cache path (both default to
# /home/pi/cache) for those paths to resolve.
set -euo pipefail

[ -f /home/pi/.frame.env ] && . /home/pi/.frame.env
if [ -z "${SRC_HOST:-}" ]; then
    echo "No source configured (config.json has no 'source'); nothing to sync." >&2
    exit 1
fi
: "${CACHE_DIR:=/home/pi/cache}"
: "${LIST:=/home/pi/files.txt}"
: "${REMOTE_CACHE:=/home/pi/cache}"
: "${REMOTE_LIST:=/home/pi/files.txt}"

mkdir -p "$CACHE_DIR"
# Mirror the cache (prune images the primary dropped), then the playlist.
rsync -az --delete "${SRC_USER}@${SRC_HOST}:${REMOTE_CACHE}/" "${CACHE_DIR}/"
rsync -az "${SRC_USER}@${SRC_HOST}:${REMOTE_LIST}" "${LIST}"

# Nudge the slideshow to pick up the new list (frame.sh relaunches fbi).
sudo pkill fbi 2>/dev/null || true
