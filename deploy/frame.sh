#!/bin/bash
# The slideshow loop. Launched from ~/.bash_profile on the tty1 autologin
# session (see deploy/install.sh) — NOT a systemd service.
#
# Why autologin and not a service: on 64-bit Raspberry Pi OS the display uses
# full KMS (vc4-kms-v3d), where /dev/fb0 is DRM fbdev *emulation*. fbi can only
# drive it from a process that genuinely owns tty1 — i.e. a real login session
# on that console. A systemd service can't provide that (fbi exits immediately,
# or `sudo fbi` from a service loses tty1), but an autologin shell on tty1 can.
# The user's older frames avoid this by running the FKMS driver instead.
#
# Looping lets the daily refresh / a manual stop just `pkill fbi`: the loop
# relaunches fbi with the freshly rebuilt playlist. The pause flag lets sleep.sh
# hold the panel off overnight without the loop fighting it.
P=/home/pi/.frame-paused
L=/home/pi/files.txt
while true; do
    if [ -e "$P" ] || [ ! -s "$L" ]; then
        sleep 2
        continue
    fi
    sudo fbi -T 1 -t 30 -a -v -u -l "$L"
    sleep 2
done
