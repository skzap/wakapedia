// this server serves the html app
// also runs the peer js connection broker server if activated in options
var Config = require('./config.json')
var express = require('express')
var app = express()
var path    = require("path")

var server = app.listen(Config.ExpressPort)
app.use('/', express.static('output'))

server.on('connection', function(conn) {})
server.on('disconnect', function(conn) {})
