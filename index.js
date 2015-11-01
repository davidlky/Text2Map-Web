var fs = require('fs');
var request = require('request');
var twilio = require('twilio');
var express = require('express');
var app = express();

try {
  fs.accessSync('GOOGLE_MAPS_API_KEY');
} catch (e) {
  console.log('Please create GOOGLE_MAPS_API_KEY file in current directory');
  process.exit();
}

var GOOGLE_MAPS_API_KEY = fs.readFileSync('GOOGLE_MAPS_API_KEY', 'utf-8').slice(0, -1);

var GOOGLE_DIRECTIONS_ENDPOINT = "https://maps.googleapis.com/maps/api/directions/json";
var GOOGLE_PLACES_ENDPOINT = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
var GOOGLE_GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

app.set('json spaces', 4);

app.get('/geocode/:address', function (req, res) {
  var address = req.params.address;

  geocode(address, function (err, geo) {
    if (err) return res.sendStatus(500);
    res.json(geo);
  });

});

app.get('/health', function (req, res) {
  request.get(GOOGLE_DIRECTIONS_ENDPOINT + '?origin=Toronto&destination=Montreal&key=' + GOOGLE_MAPS_API_KEY, function (err, resp) {
    resp = JSON.parse(resp.body);
    res.json(resp);
  });
});

var is_latlng = function (str) {
  for (var i=0; i<str.length; i++) {
    if (["-0123456789."].indexOf(str[i]) == -1) return false;
  }
  return true;
}

var fuzzy_nearby_route_loc = function (params, cb) {

  var geocode_a;
  if (is_latlng(params.from_loc)) {
    geocode_a = function (cb) {
      return cb(null, params.from_loc);
    }
  } else {
    geocode_a = function (cb) {

    }
  }

}

var geocode = function (address, cb) {
  var url = GOOGLE_GEOCODE_ENDPOINT;
  url += '?address=';
  url += address;
  url += '&key=';
  url += GOOGLE_MAPS_API_KEY;

  console.log('sending geocode request to gmaps...');

  request.get(url, function (err, resp) {
    if (err) return console.log('error', err);
    resp = JSON.parse(resp.body);
    if (resp.results.length === 0) return cb("geocode failed");


    var scores = resp.results.map(function (result) {
      return Math.pow(result.geometry.location.lat - 42.7632012, 2) +
             Math.pow(result.geometry.location.lng + 78.4410568, 2);
    });

    console.log(scores);

    var idx_of_best = 0;
    for (var i=0; i<scores.length; i++) {
      if (scores[i] < 500) return cb(null, resp.results[i].geometry.location);
      if (scores[i] < scores[idx_of_best]) idx_of_best = i;
    }

    return cb(null, resp.results[idx_of_best].geometry.location);

  });
}


var route_loc = function (params, cb) {

  var url = GOOGLE_DIRECTIONS_ENDPOINT;
  url += '?origin=';
  url += params.from_loc;
  url += '&destination=';
  url += params.to_loc;
  url += '&key=';
  url += GOOGLE_MAPS_API_KEY;

  console.log('sending route request to gmaps...');

  request.get(url, function (err, resp) {
    if (err) return console.log(err);
    resp = JSON.parse(resp.body);
    if (resp.routes.length === 0) return cb("no routes found");

    var polyline = resp.routes[0].overview_polyline.points;
    console.log('gmaps returned', polyline);
    cb(null, polyline);

  });
}

app.get('/twilio', function (req, res) {

  var message_body = req.query.Body.split('\n');
  console.log('received: ', message_body);

  var command = message_body[0].split(' ')[0];

  if (command === 'r') {
    route_loc({
      from_loc: message_body[1],
      to_loc: message_body[2],
    }, function (err, polyline) {

      var resp = new twilio.TwimlResponse();
      resp.message(message_body[0] + '\n' + polyline);

      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(resp.toString());
    });
  } else {
    console.log('unrecognized command', command);
  }


});

var port = +process.argv[2] || 4000;

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
