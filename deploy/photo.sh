#!/bin/bash
# Launched by photos.service as root — systemd owns fbi. No sudo here: fbi needs
# tty1 as its controlling terminal, and a nested sudo session loses it (fbi then
# exits right after loading its font). `exec` makes fbi the unit's main process.
pkill fbi 2>/dev/null
exec fbi -d /dev/fb0 -T 1 -t 30 -a -v -u -l /home/pi/files.txt
