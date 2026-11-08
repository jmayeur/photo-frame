#!/bin/bash
# Captured as-is from the live Pi (weekly, Sat 00:20 via cron).
#
# NOTE: a weekly unattended `apt dist-upgrade -y` followed by a reboot is risky
# on a live OS. On the Bookworm reimage this should be replaced by the
# `unattended-upgrades` package scoped to security updates only. Kept verbatim
# here so the repo reflects what actually runs today.
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
