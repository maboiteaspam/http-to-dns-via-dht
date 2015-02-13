
var express = require('express');
var http = require('http');
var httpProxy = require('node-http-proxy');
var dnsDHT = require('dns-via-dht');
var ConfigHelper = require('dns-via-dht-config');

var pkg = require('./package.json');

// see also
// https://raw.githubusercontent.com/nodejitsu/node-http-proxy/master/examples/balancer/simple-balancer.js

var HttpToDnsViaDHTClient = function(opts){

  var debug = require('debug')(pkg.name);
  var status = 'stopped';

  opts.port = opts.port || 9090;
  opts.hostname = opts.hostname || '0.0.0.0';

  opts.httpPort = opts.httpPort || 9091;

  var configPath = opts.configPath || pathExtra.homedir()+"/.dhtdns";
  var configHolder = new ConfigHelper(configPath);

  var proxy = httpProxy.createServer();
  var solver = new dnsDHT(opts);

  var privateProxyApp = express();
  privateProxyApp.use(express.static(__dirname + '/public'));
  privateProxyApp.all('*', function(req, res){
    if( status !== 'started' ){
      res.redirect('http://127.0.0.1:'+opts.httpPort+'/stopped.html');
    } else if( status === 'started') {
      var hostname = req.hostname;
      var publicKey = configHolder.getPeerPublicKey(hostname);
      if( publicKey !== false ){
        debug('found peerDNS request %s', hostname)
        debug('publicKey %s', publicKey)
        solver.resolve(hostname, publicKey, function(err, response){
          var target = { target: response.ip+':'+response.port };
          console.log('resolved request to: ', target);
          debug('peerNode %s', target);
          proxy.web(req, res, target);
        });
      } else {
        proxy.web(req, res);
      }
    }
  });
  var privateProxyServer = http.createServer(app);

  this.start = function(then){
    var that = this;
    privateProxyServer.listen(opts.httpPort, '127.0.0.1', function(){
      solver.start(function(){
        configHolder.watch(function(oldConfig, newConfig){
          if(status !=='started' ) return false;
          that.reload(oldConfig, newConfig);
        });
        status = 'started';
        if( then ) then();
      });
    });
  };

  this.stop = function(then){
    status = 'stopped';
    privateProxyServer.stop(function(){
      solver.stop(function(){
        if( then ) then();
      });
    });
  };

  this.reload = function(){
    var that = this;
    that.stop(function(){
      that.start();
    })
  };

};

module.exports = HttpToDnsViaDHTClient;