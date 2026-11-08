#!/bin/bash
# RETIRED — kept for historical reference only.
#
# This was the live Pi's weekly updater (Sat 00:20 via cron): an unattended
# `apt dist-upgrade -y` followed by a reboot, which is risky on a live OS.
# It has been replaced by the `unattended-upgrades` package (security updates
# only, auto-reboot at 03:30) — see deploy/apt/ and deploy/install.sh. It is no
# longer wired into deploy/crontab or installed by install.sh.
{
echo "**********"
echo `date`
echo "UPDATING SYSTEM SOFTWARE - UPDATE"
sudo apt-get update -y
echo "UPGRADING SYSTEM SOFTWARE - UPGRADE"
sudo apt-get upgrade -y
echo "UPGRADING SYSTEM SOFTWARE - DISTRIBUTION"
sudo apt-get dist-upgrade -y
echo "REMOVING OBSOLETE DEPENDENCIES"
sudo apt-get autoremove -y
echo "REMOVING OBSOLETE FILES"
sudo apt-get autoclean
echo "SYSTEM REBOOT"
} 2>&1 | tee /home/pi/logs/cronlog
sudo reboot
