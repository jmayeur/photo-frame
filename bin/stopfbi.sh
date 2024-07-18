#!/bin/bash

if [[ -n $(pgrep fbi) ]]; then
        sudo pkill fbi > /dev/null 2>&1
fi