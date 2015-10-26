module.exports = {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    ttl: 3600
  },
  session: {
    secret: 'is2Dio5phax0uuhi',
    cookie: 'connect.sid'
  }
}