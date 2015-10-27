# OpenID Connect Provider

## Install

- Create file *.env* from *.env.example*

- `npm install` - it runs npm & bower install

## Run

- `nf start`


## Run in production

- `sudo nf export -o /etc/init` - it install upstart scripts, run this only once!

- `sudo start foreman`

- `tail -f /var/log/foreman/web-1.log` - logs


## Useful commands

### Clean up redis

`redis-cli KEYS "waterline:access:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:auth:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:consent:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:refresh:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:user:*" | xargs redis-cli DEL`

`redis-cli KEYS "waterline:client:*" | xargs redis-cli DEL`

### Insert client

`redis-cli SET waterline:client:id:1 '{"name":"client name","redirect_uris":["http://oidc.surge.sh/callback.html"],"key":"56ce9a6a93c17d2c867c5c293482b8f9","secret":"85a879a19387afe791039a88b354a374","user":"biomio.vk.test@gmail.com","credentialsFlow":false,"createdAt":"2015-09-21T09:51:44.164Z","updatedAt":"2015-09-21T09:51:44.164Z","id":1}'`