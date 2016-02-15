# OpenID Connect Provider

## Install

- `sudo npm install pm2@latest -g` - install pm2 globally

- `npm install` - it runs npm & bower install

## Run

- `pm2 start ecosystem.json` - it runs application in local environment (in background)

- `pm2 logs openid-provider` - display real time logs


## Deploy to remote server (biom.io)

- `pm2 deploy ecosystem.json development setup` - it needs only once, it creates folder structure

- `pm2 deploy ecosystem.json production setup` - it needs only once, it creates folder structure

- `commit your last changes to the repository`

- `pm2 deploy ecosystem.json development` - deploy last revision of code to the development env and restart app

- `pm2` - display available commands


## Run in production

- `sudo npm install pm2@latest -g` - install pm2 globally

- `pm2 list` - display status of all applications

- `pm2 logs` - display logs in real time mode

- `pm2 monit` - monitor application


## Useful commands

### Clean up redis

`redis-cli KEYS "waterline:access:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:auth:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:consent:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:refresh:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:user:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:client:*" | xargs redis-cli DEL`
