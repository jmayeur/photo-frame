#!/bin/bash
# Nightly: stop the slideshow and power the panel off.
#
# systemd owns fbi, so stop the unit (cleaner than pkill, and lets getty@tty1
# return while the frame is off). Then blank the panel: vcgencmd display_power
# does NOT work under the full-KMS (vc4-kms-v3d) driver on 64-bit Raspberry Pi
# OS (returns -1); writing 4 (FB_BLANK_POWERDOWN) to the framebuffer's sysfs
# blank node drives the connector's DPMS off instead. The framebuffer contents
# are preserved, so wake.sh brings back the last photo.
sudo systemctl stop photos.service
echo 4 | sudo tee /sys/class/graphics/fb0/blank > /dev/null
