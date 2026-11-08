#!/bin/bash
# Nightly: stop the slideshow and power the panel off.
#
# vcgencmd display_power does NOT work under the full-KMS (vc4-kms-v3d) driver
# used by 64-bit Raspberry Pi OS — it returns display_power=-1. Writing 4
# (FB_BLANK_POWERDOWN) to the framebuffer's sysfs blank node drives the
# connector's DPMS off instead, which actually powers the panel down. The
# framebuffer contents are preserved, so wake.sh brings back the last photo.
#
# fbi is stopped first because any repaint (the slideshow advances every 30s)
# would un-blank the framebuffer.
if [[ -n $(pgrep fbi) ]]; then
    sudo pkill fbi > /dev/null 2>&1
fi
echo 4 | sudo tee /sys/class/graphics/fb0/blank > /dev/null
