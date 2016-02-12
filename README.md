# OpenID Connect Provider

## Install

- `npm install pm2@latest -g` - install pm2 globally

- `npm install` - it runs npm & bower install

## Run

- `pm2 start ecosystem.json` - ut runs application in local environment


## Run in production

- `sudo nf export -o /etc/init -a openidprovider -l /home/biomio/openid/logs` - it install upstart scripts, run this only once! or if you change .env file

- `sudo start openidprovider` - start service

- `sudo status openidprovider` - status of service

- `sudo restart openidprovider` - restart service

- `sudo stop openidprovider` - stop service

- `tail -f /home/biomio/openid/logs/openidprovider/web-1.log` - logs


## Useful commands

### Clean up redis

`redis-cli KEYS "waterline:access:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:auth:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:consent:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:refresh:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:user:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:client:*" | xargs redis-cli DEL`
