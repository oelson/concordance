#!/bin/sh
sudo ln -s ./init-script /etc/init.d/concordance
sudo update-rc.d -f concordance defaults
