#!/bin/bash
# Nightly: pause the slideshow and power the panel off.
#
# frame.sh relaunches fbi whenever it's killed, so set a pause flag it checks
# before killing fbi (wake.sh clears it). Then blank the panel: vcgencmd
# display_power returns -1 and does nothing under full KMS (vc4-kms-v3d), so
# write 4 (FB_BLANK_POWERDOWN) to the framebuffer's sysfs blank node instead.
# The framebuffer is preserved, so wake.sh shows the last photo.
touch /home/pi/.frame-paused
sudo pkill fbi 2>/dev/null
echo 4 | sudo tee /sys/class/graphics/fb0/blank > /dev/null
