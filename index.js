var fs = require('fs');
var http = require('http');
var https = require('https');
var express = require('express');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
var _ = require('underscore');
var request = require('request');
var hbs = require('hbs');
var crypto = require('crypto');
var moment = require('moment');

require(process.env.HOME + '/statesecrets/DwollaCredentials.js');
require(process.env.HOME + '/statesecrets/Salt.js');

var shasum;
var strength = 100; // how many times should we sha512 it

function computeHash(val) {
	var before = Salt.before + val + Salt.after;
	
	for(var i=1; i<strength; i++) {
		shasum = crypto.createHash('sha512');
		shasum.update(before);
		before = shasum.digest('base64');
	}
	
	shasum = crypto.createHash('sha512');
	shasum.update(before);
	var ret = shasum.digest('base64');
	ret = ret.replace(/\//g, '*');
	return ret;
}


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
var tokenGenerator = new FirebaseTokenGenerator('guYIxlAsh207AG6yY1PljQodWvJ3gkVWuxUFcSg7');

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

	var code = req.query.code;
	var url = 'https://www.dwolla.com/oauth/v2/token?client_id=' + encodeURIComponent(Dwolla.client_id) + '&client_secret=' + encodeURIComponent(Dwolla.secret) + '&grant_type=authorization_code&redirect_uri=' + encodeURIComponent('https://' + req.host + '/account') + '&code=' + encodeURIComponent(req.query.code);

	request.get({
		url: url,
		json: true
	}, function(error, response, body) {
		if(body && body.error) {
			errorPage(res, body.error, body.error_description, JSON.stringify({
				host: req.host,
				code: req.query.code,
				url: url
			}, undefined, 4));
			return;	
		}
		
		if(!body || !body.access_token) {
			errorPage(res, "Where is your access token?", "Dwolla should have sent one back but they must have lost it...");
			return;
		}
		
		var access_token = body.access_token;
		
		request.get({
			url: 'https://www.dwolla.com/oauth/rest/users/?oauth_token=' + encodeURIComponent(access_token),
			json: true
		}, function(error, response, body) {
			if(body && body.error) {
				errorPage(res, body.error, body.error_description);
				return;	
			}
			
			if(!body || !body.Success) {
				errorPage(res, "We didn't get a success?", "Nor did we get an error... what a conundrum.", JSON.stringify({
					access_token: access_token,
					code: code,
					body: body
				}, undefined, 4));
				return;
			}
			
			var fbUser = firebase_root.child('Users').child(body.Response.Id);
			
			fbUser.update({
				access_token: access_token,
				name: body.Response.Name,
				city: body.Response.City,
				state: body.Response.State
			});
			
			fbUser.child('cards').once('value', function(snapshot) {
				var cardData = snapshot.val();
				
				_.each(cardData, function(card) {
					if(card.time_linked) card.time_linked = moment(card.time_linked).fromNow();
				});
				
				res.render('account.tmpl', {
					access_token: access_token,
					cards: cardData
				});
			});
		});
	});
});

app.post('/api/link', function(req, res) {
	if(!req || !req.body || !req.body.access_token || !req.body.card || !req.body.exp_month || !req.body.exp_year) {
		res.json({
			error: 'You must POST an access_token, a card, an exp_month, and an exp_year.'
		});
		return;
	}
	
	request.get({
		url: 'https://www.dwolla.com/oauth/rest/users/?oauth_token=' + encodeURIComponent(req.body.access_token),
		json: true
	}, function(error, response, body) {
		if(body && body.error) {
			res.json({
				error: error_message
			});
			return;	
		}
		
		if(!body || !body.Success) {
			res.json({
				error:  "We didn't get a success? Nor did we get an error... what a conundrum."
			});
			return;
		}
		
		var hash = computeHash(req.body.card);
		
		firebase_root.child('Users').child(body.Response.Id).child('cards').child(hash).set({
			type: cardFromNumber(req.body.card),
			exp_month: req.body.exp_month,
			exp_year: req.body.exp_year,
			last_two: req.body.card.substring(req.body.card.length-2),
			time_linked: Firebase.ServerValue.TIMESTAMP
		});
		
		firebase_root.child('Cards').child(hash).set(body.Response.Id);
		
		res.json({
			success: true,
			hash: hash
		});
	});
});

app.post('/api/unlink', function(req, res) {
	if(!req || !req.body || !req.body.access_token || !req.body.hash) {
		res.json({
			error: 'You must POST an access_token, and a hash.'
		});
		return;
	}
	
	request.get({
		url: 'https://www.dwolla.com/oauth/rest/users/?oauth_token=' + encodeURIComponent(req.body.access_token),
		json: true
	}, function(error, response, body) {
		if(body && body.error) {
			res.json({
				error: error_message
			});
			return;	
		}
		
		if(!body || !body.Success) {
			res.json({
				error:  "We didn't get a success? Nor did we get an error... what a conundrum."
			});
			return;
		}
		
		var fbHash = firebase_root.child('Users').child(body.Response.Id).child('cards').child(req.body.hash);
		
		fbHash.once('value', function(snapshot) {
			var val = snapshot.val();
			if(!val) {
				res.json({
					error: 'Card with that hash not found for this user.'
				});
				return;
			}
			
			fbHash.remove();
			firebase_root.child('Cards').child(req.body.hash).remove();
			
			res.json({
				success: true
			});
		});
		
		res.json({
			success: true
		});
	});
});

app.get('/api/hasdwolla', function(req, res) {
	if(!req || !req.query || !req.query.card) {
		res.json({
			error: 'You must GET a card.'
		});
		return;
	}
	
	var hash = computeHash(req.query.card);
	firebase_root.child('Cards').child(hash).once('value', function(snapshot) {
		var val = snapshot.val();
		if(val) {
			res.json({
				hasdwolla: true
			});
		} else {
			res.json({
				hasdwolla: false
			});
		}
	});
});

http.createServer(app).listen(80);
https.createServer({
	key: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.key'),
	cert: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.crt')
}, app).listen(443);

function errorPage(res, title, message, dump) {
	res.render('error.tmpl', {
		title: title,
		message: message,
		stack: new Error().stack,
		dump: dump
	});
}

var cards = [
	{
		type: 'maestro',
		pattern: /^(5018|5020|5038|6304|6759|676[1-3])/,
		length: [12, 13, 14, 15, 16, 17, 18, 19],
		cvcLength: [3],
		luhn: true
	}, {
		type: 'dinersclub',
		pattern: /^(36|38|30[0-5])/,
		length: [14],
		cvcLength: [3],
		luhn: true
	}, {
		type: 'laser',
		pattern: /^(6304|6706|6771|6709)/,
		length: [16, 17, 18, 19],
		cvcLength: [3],
		luhn: true
	}, {
		type: 'jcb',
		pattern: /^35/,
		length: [16],
		cvcLength: [3],
		luhn: true
	}, {
		type: 'unionpay',
		pattern: /^62/,
		length: [16, 17, 18, 19],
		luhn: false
	}, {
		type: 'discover',
		pattern: /^(6011|65|64[4-9]|622)/,
		length: [16],
		cvcLength: [3],
		luhn: true
	}, {
		type: 'mastercard',
		pattern: /^5[1-5]/,
		length: [16],
		cvcLength: [3],
		luhn: true
	}, {
		type: 'amex',
		pattern: /^3[47]/,
		length: [15],
		cvcLength: [4],
		luhn: true
	}, {
		type: 'visa',
		pattern: /^4/,
		length: [13, 14, 15, 16],
		cvcLength: [3],
		luhn: true
	}
];

var cardFromNumber = function(num) {
	var card, _i, _len;
	num = (num + '').replace(/\D/g, '');
	for (_i = 0, _len = cards.length; _i < _len; _i++) {
		card = cards[_i];
		if (card.pattern.test(num)) {
			return card.type;
		}
	}
	return 'unknown';
};