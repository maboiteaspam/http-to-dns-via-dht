#!/usr/bin/env node

var program = require('commander');
var spawn = require('child_process').spawn;
var HttpToDnsViaDHT = require('./index.js');

var pkg = require('./package.json');


// Configure CLI

program
  .version(pkg.version);

program
  .option('-v, --verbose',
  'enable verbosity');

program.command('listen')

  .option('--port <port>',
  'port to listen')
  .option('--hostname <hostname>',
  'hostname to listen')
  .option('-d, --detach',
  'Detach process')

  .description('Start server')
  .action(function(port){
    var command = arguments[arguments.length-1];
    var opts = {
      port: parseInt(command.port) || 9090,
      hostname: command.hostname || '0.0.0.0',
      httpPort: parseInt(command.port) || 9091,
      httpHostname: command.hostname || '0.0.0.0'
    };

    if (program.verbose) {
      process.env['DEBUG'] = pkg.name;
      process.env['DEBUG'] = '*';
    }
    var debug = require('debug')(pkg.name);


    var startProgram = function(){

      debug('%s', JSON.stringify(opts) );

      console.log('Starting server');

      var server = new HttpToDnsViaDHT(opts);
      server.start(function(){
        console.log('Server ready');
        console.log("server : %j", server.address());
      });
    };

    if(command.detach) {
      var cmdLine = [];
      process.argv.forEach(function (val) {
        if(!val.match(/^(-d|--detach)$/) ) cmdLine.push(val);
      });
      debug('%s', cmdLine)
      var detachedProcess = spawn(cmdLine.shift(), cmdLine,
        {detached: true, stdio:'inherit' });
      detachedProcess.unref();
    } else {
      startProgram();
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
