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
  appId: "c627a2be0296339ba9341fc919dcd8c6",
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