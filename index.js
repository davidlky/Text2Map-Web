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
var GOOGLE_MAPS_ENDPOINT = "https://maps.googleapis.com/maps/api/directions/json";

app.set('json spaces', 4);

app.get('/route/from/:from_loc/to/:to_loc', function (req, res) {
  var from_loc = req.params.from_loc;
  var to_loc = req.params.to_loc;

  request.get(GOOGLE_MAPS_ENDPOINT + '?origin=' + from_loc + '&destination=' + to_loc + '&key=' + GOOGLE_MAPS_API_KEY, function (err, resp) {
    resp = JSON.parse(resp.body);
    res.send(resp.routes[0].overview_polyline.points);
  });
});

app.get('/route/from-latlng/:lat/:long/to/:loc', function (req, res) {
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

var route_loc = function (params, cb) {

  var url = GOOGLE_MAPS_ENDPOINT;
  url += '?origin=';
  url += params.from_loc;
  url += '&destination=';
  url += params.to_loc;
  url += '&key=';
  url += GOOGLE_MAPS_API_KEY;

  console.log('sending request to gmaps...');

  request.get(url, function (err, resp) {
    if (err) {
      console.log('errror', err);
    } else {
      resp = JSON.parse(resp.body);    
      if (resp.routes.length === 0) {
        console.log(err);
        cb(null, "no routes found");
      } else {
        var polyline = resp.routes[0].overview_polyline.points;
        console.log('gmaps returned', polyline);
        cb(null, polyline);
      }
    }
  });
}

app.get('/twilio', function (req, res) {

  var message_body = req.query.Body.split('\n');
  console.log('received: ', message_body);

  route_loc({
    from_loc: message_body[1],
    to_loc: message_body[2],
  }, function (err, polyline) {

    var resp = new twilio.TwimlResponse();
    resp.message(message_body[0] + '\n' + polyline);

    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(resp.toString());
  });

});

var port = +process.argv[2] || 4000;

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
