#!/usr/bin/env node

var program = require('commander');
var spawn = require('child_process').spawn;
var HttpToDnsViaDHT = require('./index.js');

var pkg = require('./package.json');


