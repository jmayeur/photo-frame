#!/bin/bash
# Stop the slideshow. systemd owns fbi, so stop the unit (this also lets
# getty@tty1 return for maintenance). Kept for manual/console use.
sudo systemctl stop photos.service
