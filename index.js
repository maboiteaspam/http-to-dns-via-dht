

var pkg = require('./package.json');

// see also
// https://raw.githubusercontent.com/nodejitsu/node-http-proxy/master/examples/balancer/simple-balancer.js

var HttpToDnsViaDHT = {
  Client: require('./client.js'),
  Server: require('./server.js')
};

module.exports = HttpToDnsViaDHT;