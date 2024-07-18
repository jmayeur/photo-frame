#!/bin/bash

if [[ -n $(pgrep fbi) ]]; then
        sudo pkill fbi > /dev/null 2>&1
fi

# v - display image source file name
sudo fbi -d /dev/fb0 -T 1 -t 30 -a -v -u -l /home/pi/files.txt