
var express = require('express');
var http = require('http');
var httpProxy = require('node-http-proxy');
var dnsDHT = require('dns-via-dht');

var pkg = require('./package.json');

// see also
// https://raw.githubusercontent.com/nodejitsu/node-http-proxy/master/examples/balancer/simple-balancer.js

var HttpToDnsViaDHT = function(opts){

  var debug = require('debug')(pkg.name);
  var status = 'stopped';
  var userSessions = {};

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
      res.redirect('http://'+opts.httpHostname+':'+opts.httpPort+'/stopped.html');
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


  var publicProxyApp = express();
  publicProxyApp.all('*', function(req, res){
    if( status === 'started') {
      var hostname = req.hostname;
      var nounce = req.get('x-nounce');
      var config = configHolder.getConfig();
      var localProxyTarget = config.httpProxy[hostname];
      var userSession = userSessions[nounce];
      if(localProxyTarget){
        if(userSession && userSession.question === hostname && userSession.nounce === nounce){
          // do more verification process ?
          // proxy request to local server
          // should update response to add x-identify and x-signature headers to response
          proxy.web(req, res, config.httpProxy[hostname]);
        }
      }
    }
  });
  var publicProxyServer = http.createServer(publicProxyApp);

  this.start = function(then){
    var that = this;
    privateProxyServer.listen(opts.httpPort, function(){
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

  this.serve = function(then){
    var that = this;
    solver.start(function(){
      configHolder.watch(function(oldConfig, newConfig){
        if(status !=='started' ) return false;
        that.reload(oldConfig, newConfig);
      });
      var announced = configHolder.getConfig().announced;
      Object.keys(announced).forEach(function(dns){
        debug('reload announce %s', dns);
        solver.announce(dns, announced[dns]);
      });
      status = 'started';
      publicProxyServer.listen(opts.httpPort, then);
    }, function(addr, question, publicKey, nounce){
      if( status === 'started' ){
        debug('supply peer dns request %s', question)
        debug('publicKey %s', publicKey)
        debug('nounce %s', nounce)
        //- holypunch ?
        userSessions[publicKey] = {
          addr: ''+addr,
          publicKey: publicKey,
          nounce: nounce,
          question: question
        };
      }
    });
  };
};

module.exports = HttpToDnsViaDHT;