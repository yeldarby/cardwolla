var fs = require('fs');
var http = require('http');
var https = require('https');
var express = require('express');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
var _ = require('underscore');
var request = require('request');
var hbs = require('hbs');

var app = express();

app.configure('development', function() {
	app.use(express.bodyParser());
	app.use(express.errorHandler());
	app.use(express.compress());
	
	app.locals.pretty = true;
	
	app.set("view engine", 'hbs');
	app.set("view options", { layout: false });
	
	app.engine('tmpl', require('hbs').__express);
	
	app.use(express.static(__dirname + '/public'));
});

var firebase_root_url = 'https://cardwolla.firebaseio.com';
var firebase_root = new Firebase(firebase_root_url);
var tokenGenerator = new FirebaseTokenGenerator('zqObmd1CMMc0AnsR2UbqZSi4fpw5ZZtTcZm2xEHd');

var adminToken = tokenGenerator.createToken({}, {
	admin: true,
	debug: false,
	expires: 1577836800	// A long long time from now.
});

console.log('Firebase admin token:', adminToken);

firebase_root.auth(adminToken);

app.post('/', function(req, res) {
	res.sendfile(__dirname + '/public/index.html');
});

http.createServer(app).listen(80);
https.createServer({
	key: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.key'),
	cert: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.crt')
}, app).listen(443);
