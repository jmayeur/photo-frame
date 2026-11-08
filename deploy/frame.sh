#!/bin/bash
# The slideshow loop. Launched from ~/.bash_profile on the tty1 autologin
# session (see deploy/install.sh) — NOT a systemd service.
#
# Why autologin and not a service: on 64-bit Raspberry Pi OS the display uses
# full KMS (vc4-kms-v3d), where /dev/fb0 is DRM fbdev *emulation*. fbi can only
# drive it from a process that genuinely owns tty1 — i.e. a real login session
# on that console. A systemd service can't provide that (fbi exits immediately,
# or `sudo fbi` from a service loses tty1), but an autologin shell on tty1 can.
#
# The fbi options and playlist come from ~/.frame.env (generated from config.json
# by install.sh / `npm run frame-env`), so the overlay (-v / --noverbose), timer,
# tty and device are all config-driven. Defaults match a verbose primary frame.
#
# Looping lets the daily refresh (primary) or sync (client) just `pkill fbi`: the
# loop relaunches with the fresh playlist. The pause flag lets sleep.sh hold the
# panel off overnight without the loop fighting it.
[ -f /home/pi/.frame.env ] && . /home/pi/.frame.env
: "${FBI_OPTS:=-d /dev/fb0 -T 1 -t 30 -a -u -v}"
: "${LIST:=/home/pi/files.txt}"
P=/home/pi/.frame-paused

while true; do
    if [ -e "$P" ] || [ ! -s "$LIST" ]; then
        sleep 2
        continue
    fi
    sudo fbi $FBI_OPTS -l "$LIST"
    sleep 2
done
