#!/bin/bash
# Morning: power the panel back on by clearing the framebuffer blank.
#
# The framebuffer was preserved while blanked, so the last pre-sleep photo
# reappears immediately. The 07:15 refreshDay.sh rebuilds today's playlist and
# restarts fbi, resuming the slideshow.
echo 0 | sudo tee /sys/class/graphics/fb0/blank > /dev/null
