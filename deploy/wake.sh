#!/bin/bash
# Morning: clear the pause flag (frame.sh relaunches fbi within ~2s) and power
# the panel back on.
rm -f /home/pi/.frame-paused
echo 0 | sudo tee /sys/class/graphics/fb0/blank > /dev/null
