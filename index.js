var fs = require('fs');
var request = require('request');
var twilio = require('twilio');
var express = require('express');
var async = require('async');
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

var NORTH_AMERICA = {
  'lat': 42.7632012,
  'lng': -78.4410568
}

app.set('json spaces', 4);

app.get('/geocode/:address', function (req, res) {
  var address = req.params.address;

  geocode(address, NORTH_AMERICA, 500, function (err, geo) {
    if (err) return res.sendStatus(500);
    res.json(geo);
  });

});

app.get('/route/:from_loc/:to_loc', function (req, res) {
  route_loc(req.params.from_loc, req.params.to_loc, function (err, polyline) {
    if (err) return res.sendStatus(500);
    return res.json(polyline);
  });
});

app.get('/food/:from_loc', function (req, res) {
  nearby_food(req.params.from_loc, function (err, resp) {
    if (err) return res.sendStatus(500);
    return res.json(resp);
  });
});

app.get('/macdonalds/:from_loc', function (req, res) {
  nearby_wifi_generator('macdonalds')(req.params.from_loc, function (err, resp) {
    if (err) return res.sendStatus(500);
    return res.json(resp);
  });
});

app.get('/wifi/:from_loc', function (req, res) {
  nearby_wifi(req.params.from_loc, function (err, resp) {
    console.log('yo!');
    if (err) return res.sendStatus(500);
    return res.json(resp);
  });
});

app.get('/health', function (req, res) {
  request.get(GOOGLE_DIRECTIONS_ENDPOINT + '?origin=Toronto&destination=Montreal&key=' + GOOGLE_MAPS_API_KEY, function (err, resp) {
    resp = JSON.parse(resp.body);
    res.json(resp);
  });
});

var is_latlng = function (str) {
  for (var i=0; i<str.length; str++) {
    if ("-.0123456789".indexOf(str[i]) === -1) return false;
  }
  return true;
}

var geocode = function (address, near_ll, radius, cb) {

  if (is_latlng(address)) return cb(null, {
    'lat': +address.split(',')[0],
    'lng': +address.split(',')[1]
  });

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
      return Math.pow(result.geometry.location.lat - near_ll.lat, 2) +
             Math.pow(result.geometry.location.lng - near_ll.lng, 2);
    });

    var idx_of_best = 0;
    for (var i=0; i<scores.length; i++) {
      if (scores[i] < radius) return cb(null, resp.results[i].geometry.location);
      if (scores[i] < scores[idx_of_best]) idx_of_best = i;
    }

    return cb(null, resp.results[idx_of_best].geometry.location);

  });
}

var nearby_wifi = function (from_loc, cb) {
  async.map(['macdonalds', 'starbucks', 'timhortons'], function (chain, cb) {
    nearby_wifi_generator(chain)(from_loc, cb);
  }, function (err, res) {
    if (err) return cb(err);
    console.log(res);
    return cb(null, [].concat.apply(res));
  });
}

var nearby_wifi_generator = function (chain) {

  return function (from_loc, cb) {

    geocode(from_loc, NORTH_AMERICA, 500, function (err, ll) {
      if (err) return cb(err);

      var url = GOOGLE_PLACES_ENDPOINT;
      url += '?location=';
      url += [ll.lat, ll.lng].join(',');
      url += '&radius=1000';
      url += '&keyword=';
      url += chain;
      url += '&key=';
      url += GOOGLE_MAPS_API_KEY;

      request.get(url, function (err, resp) {
        if (err) return console.log('error', err);
        resp = JSON.parse(resp.body);

        return cb(null, resp.results.map(function (result) {
          var ret = result.geometry.location;
          ret.name = result.name;
          return ret;
        }));

      });

    });
  }
}


var nearby_food = function (from_loc, cb) {

  console.log('nearby_food', from_loc);

  geocode(from_loc, NORTH_AMERICA, 500, function (err, ll) {
    if (err) return cb(err);

    var url = GOOGLE_PLACES_ENDPOINT;
    url += '?location=';
    url += [ll.lat, ll.lng].join(',');
    url += '&radius=500';
    // url += '&opennow=true';
    url += '&types=food';
    url += '&key=';
    url += GOOGLE_MAPS_API_KEY;

    request.get(url, function (err, resp) {
      if (err) return console.log('error', err);
      resp = JSON.parse(resp.body);

      return cb(null, resp.results.map(function (result) {
        var ret = result.geometry.location;
        ret.name = result.name;
        return ret;
      }));

    });

  });

}

var route_loc = function (from_loc, to_loc, cb) {

  console.log('route_loc', from_loc, to_loc);

  var url = GOOGLE_DIRECTIONS_ENDPOINT;
  url += '?origin=';
  url += from_loc;
  url += '&destination=';
  url += to_loc;
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
    route_loc(message_body[1], message_body[2], function (err, polyline) {

      var resp = new twilio.TwimlResponse();
      resp.message(message_body[0] + '\n' + polyline);

      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(resp.toString());
    });
  } else if (command === 'f') {
    nearby_food(message_body[1], function (err, wifi_arr) {

      console.log('sending nearby_food sms');

      var resp = new twilio.TwimlResponse();
      resp.message(message_body[0] + '\n' + wifi_arr.map(function (food) {
        return [food.lat, food.lng, food.name].join(' ')
      }).join('\n'));

      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(resp.toString());

    });
  } else if (command === 'w') {

    nearby_wifi(message_body[1], function (err, wifi_arr) {
      console.log('sending nearby_wifi sms', wifi_arr);

      var resp = new twilio.TwimlResponse();

      resp.message(message_body[0] + '\n' + wifi_arr.map(function (food) {
        return [food.lat, food.lng, food.name].join(' ')
      }).join('\n'));

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
