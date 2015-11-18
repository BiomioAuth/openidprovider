module.exports = {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    ttl: 3600
  },
  session: {
    secret: "is2Dio5phax0uuhi",
    cookie: "connect.sid"
  },
  gate: {
    websocketUrl: process.env.GATE_URL
  },
  appId: "32ec6214f5b17ecf769d9d2a6c179742",
  resources: [
    {
      rProperties: "",
      rType: "fp-scanner"
    },
    /*      {
     rProperties: "",
     rType: "ldap"
     }*/
  ]
}