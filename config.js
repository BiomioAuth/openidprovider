module.exports = {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  session: {
    secret: 'is2Dio5phax0uuhi',
    cookie: 'connect.sid'
  }
}