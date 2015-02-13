
var express = require('express');
var http = require('http');
var httpProxy = require('node-http-proxy');
var dnsDHT = require('dns-via-dht');
var ConfigHelper = require('dns-via-dht-config');
var portscanner = require('portscanner');

var pkg = require('./package.json');

// see also
// https://raw.githubusercontent.com/nodejitsu/node-http-proxy/master/examples/balancer/simple-balancer.js

var HttpToDnsViaDHTServer = function(opts){

  var debug = require('debug')(pkg.name);
  var status = 'stopped';

  opts.port = opts.port || 9090;
  opts.hostname = opts.hostname || '0.0.0.0';


  var configPath = opts.configPath || pathExtra.homedir()+"/.dhtdns";
  var configHolder = new ConfigHelper(configPath);

  var proxys = [];
  var solver = new dnsDHT(opts);

  this.stop = function(then){
    status = 'stopped';
    proxys.forEach(function(proxy){
      proxy.stop();
    });
    solver.stop(function(){
      if( then ) then();
    });
  };

  this.reload = function(then){
    var that = this;
    that.stop(function(){
      that.start(then);
    })
  };

  this.start = function(then){
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
      if(then) then();
      status = 'started';
    }, function(addr, question, publicKey, nounce){
      if( status === 'started' ){
        debug('supply peer dns request %s', question)
        debug('publicKey %s', publicKey)
        debug('nounce %s', nounce)
        //- holypunch ?
        if( status === 'started') {
          var config = configHolder.getConfig();
          var localProxyTarget = config.httpProxy[question];
          if(localProxyTarget){
            // proxy request to local server
            // should update response to add x-identify and x-signature headers to response
            portscanner.findAPortNotInUse(9090, 9090+5000, '127.0.0.1', function(error, port) {
              proxys.push(httpProxy.createServer({
                  target:config.httpProxy[question]
                }).listen(9091, '0.0.0.0')
              );
            });
          }
        }
      }
    });
  };
};

module.exports = HttpToDnsViaDHTServer;