var express = require('express');
var app = express();
var allKittiesMethods = require('./getAllKitties.js');
var browseKittiesMethods = require('./browseKitties.js');

var port = process.env.PORT || 8080;

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
    res.render('index');
});

app.get('/kitty/:id', (req, res) => {
	let kittyId = req.params.id;
	let kitty = allKittiesMethods.getKitty(kittyId);
	if(kitty != undefined) {
		res.render('kitty', {kitty : JSON.stringify(kitty)});
	} else {
		res.render('404');
	}
});

app.get('/profile/:address', function(req, res) {
	let address = req.params.address;

	res.render('owner', {tokens : browseKittiesMethods.kittiesOfOwner(address, allKittiesMethods.getKitties())});
});

app.listen(port, function() {
    console.log('Our app is running on port : ' + port);
});

// Update des kitties
allKittiesMethods.getAllKitties();