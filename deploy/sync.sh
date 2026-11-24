#!/bin/bash
# Client mode: pull the primary frame's prepared playlist + cache instead of
# scanning the NAS. Requires key-based SSH from this frame's user to the primary
# (ssh-keygen here, ssh-copy-id to the primary — see README).
#
# The playlist (files.txt) references cache paths like /home/pi/cache/NAME.jpg,
# so the client's cacheDir must match the primary's cache path (both default to
# /home/pi/cache) for those paths to resolve.
#
# Timing: the primary's 07:15 rebuild takes anywhere from ~10 to 40+ minutes
# (HEIC decodes on a Pi 3), and it writes files.txt LAST, after the cache is
# built and pruned. So "the primary's files.txt is dated today" means the
# primary is done. Cron runs this every 10 minutes through the morning. Each
# run does nothing until the primary is ready, then one run pulls, and later
# runs see today's list is already here and exit. This also keeps us from
# mirroring a half-built cache mid-rebuild.
#
#   sync.sh          pull only if the primary finished today's rebuild
#   sync.sh --force  pull whatever the primary has now
set -euo pipefail

log() { echo "$(date '+%F %T') $*"; }

[ -f /home/pi/.frame.env ] && . /home/pi/.frame.env
if [ -z "${SRC_HOST:-}" ]; then
    log "No source configured (config.json has no 'source'); nothing to sync." >&2
    exit 1
fi
: "${CACHE_DIR:=/home/pi/cache}"
: "${LIST:=/home/pi/files.txt}"
: "${REMOTE_CACHE:=/home/pi/cache}"
: "${REMOTE_LIST:=/home/pi/files.txt}"
REMOTE="${SRC_USER}@${SRC_HOST}"

if [ "${1:-}" != "--force" ]; then
    today=$(date +%F)
    # Already pulled today's list on an earlier run (rsync -a keeps the
    # primary's mtime)? Nothing to do.
    if [ -s "$LIST" ] && [ "$(date -r "$LIST" +%F)" = "$today" ]; then
        exit 0
    fi
    remote_day=$(ssh -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE" \
        "date -r '$REMOTE_LIST' +%F 2>/dev/null || echo missing")
    if [ "$remote_day" != "$today" ]; then
        log "primary not ready (its files.txt is from $remote_day); will retry"
        exit 0
    fi
fi

mkdir -p "$CACHE_DIR"
# Mirror the cache (prune images the primary dropped), then the playlist.
rsync -az --delete "${REMOTE}:${REMOTE_CACHE}/" "${CACHE_DIR}/"
tmp="${LIST}.new"
rsync -az "${REMOTE}:${REMOTE_LIST}" "$tmp"

if [ -s "$LIST" ] && cmp -s "$tmp" "$LIST"; then
    mv "$tmp" "$LIST"   # same photos; still take the new mtime so later runs exit early
    log "playlist unchanged; fbi left running"
    exit 0
fi
mv "$tmp" "$LIST"
log "synced $(wc -l < "$LIST") photos from $SRC_HOST"

# Nudge the slideshow to pick up the new list (frame.sh relaunches fbi).
sudo pkill fbi 2>/dev/null || true
