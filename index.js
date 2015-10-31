var fs = require('fs');
var request = require('request');
var express = require('express');
var app = express();

try {
  fs.accessSync('GOOGLE_MAPS_API_KEY');
} catch (e) {
  console.log('Please create GOOGLE_MAPS_API_KEY file in current directory');
  process.exit();
}

var GOOGLE_MAPS_API_KEY = fs.readFileSync('GOOGLE_MAPS_API_KEY', 'utf-8').slice(0, -1);
var GOOGLE_MAPS_ENDPOINT = "https://maps.googleapis.com/maps/api/directions/json";

app.set('json spaces', 4);

app.get('/route/from/:lat/:long/to/:loc', function (req, res) {
  var from_lat = req.params.lat;
  var from_lng = req.params.lng;
  var to_loc = req.params.loc
  res.json({
    'lat': lat,
  });
});

app.get('/health', function (req, res) {
  request.get(GOOGLE_MAPS_ENDPOINT + '?origin=Toronto&destination=Montreal&key=' + GOOGLE_MAPS_API_KEY, function (err, resp) {
    resp = JSON.parse(resp.body);
    res.json(resp);
  });
});


var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});