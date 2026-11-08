#!/bin/bash
# Stop the slideshow and keep it stopped (frame.sh would otherwise relaunch it).
# Clear the flag with: rm /home/pi/.frame-paused
touch /home/pi/.frame-paused
sudo pkill fbi 2>/dev/null
