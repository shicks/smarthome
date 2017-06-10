# smarthome
A smart home server designed to run on a Raspberry Pi Zero W and interface with ESP8266 "smart things".



## Checklist

Things to do to get this up and running on a Raspberry Pi Zero W

* install NodeJS and NPM
  * https://www.raspberrypi.org/forums/viewtopic.php?f=34&t=140747
  * https://blog.miniarray.com/installing-node-js-on-a-raspberry-pi-zero-21a1522db2bb
  * TODO - NPM@5?
* install chrony (instead of ntp)
* set up config files w/ domain maps, etc (back these up somewhere outside github?)
* fail2ban
  * http://kamilslab.com/2016/12/11/how-to-install-fail2ban-on-the-raspberry-pi/
* fstab for tmpfs
  * http://www.zdnet.com/article/raspberry-pi-extending-the-life-of-the-sd-card/

* root crontab -e
  * @reboot /home/pi/autostart
* ~/autostart

```
#!/bin/sh

user=`whoami`
if [ "$user" != "pi" ]; then
    exec sudo su -c "$0 $@" pi
fi

cd ~pi/src/smarthome
nohup node out/fe/index.js config >/dev/null 2>/dev/null &```
