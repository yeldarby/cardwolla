var fs = require('fs');
var http = require('http');
var https = require('https');
var express = require('express');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
var _ = require('underscore');
var request = require('request');
var hbs = require('hbs');

var Dwolla = {
	client_id: 'omoEV76AYr7MemVMRGF98K2JaQV+iWLAoO/0+K7P1HtH+mzXlP',
	secret: '+X4Km7BtUR/LnO22d95pNbm2wR0mIj1Yle4XKvaxfREfLj21v1'	
};

var app = express();

app.configure('development', function() {
	app.use(function(req,res,next) {
		if (!/https/.test(req.protocol)){
			res.redirect("https://" + req.headers.host + req.url);
		} else {
			return next();
		} 
	});

	app.use(express.bodyParser());
	app.use(express.errorHandler());
	app.use(express.compress());
	
	app.locals.pretty = true;
	
	app.set("view engine", 'hbs');
	app.set("view options", { layout: false });
	
	app.engine('tmpl', require('hbs').__express);
	
	app.use(express.static(__dirname + '/public'));
	
	app.use(function(req, res, next) {
		if(req && req.query && req.query.error) {
			errorPage(res, req.query.error, req.query.error_description);
		} else {
			next();
		}
	});
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

app.all('/', function(req, res) {
	res.sendfile(__dirname + '/public/index.html');
});

app.all('/account', function(req, res) {
	if(!req.query || !req.query.code) {
		errorPage(res, "Missing Code", "How can you eat your access token if you don't receive your code?!");
		return;
	}

	res.json({
		loggedIn: true
	});
});

http.createServer(app).listen(80);
https.createServer({
	key: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.key'),
	cert: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.crt')
}, app).listen(443);

function errorPage(res, title, message) {
	res.render('error.tmpl', {
		title: title,
		message: message
	});
}
