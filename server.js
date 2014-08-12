'use strict';

var config = require('./server/config'),
    express = require('express'),
    server = module.exports = express(),
    WP = require('wordpress-rest-api'),
    _ = require('lodash');

// Wordpress Rest API (client)
// Not use with auth on production
var wp = new WP({ endpoint: 'http://ae.filos.unam.mx/wp-json' });

// Middlewares
server.use(require('body-parser').json());
server.use(require('body-parser').urlencoded({
  extended: true
}));
server.use(require('cookie-parser')());
server.use(require('method-override')());
server.use(require('express-session')({ secret: config.secret }));

// Template engine
server.set('view engine', 'ejs');
server.set('views', __dirname + '/public');

// Static files
server.use(express.static(__dirname + '/public'));

// Get data from Wordpress
var getDataFromWordpress = function () {
  console.log('Get data from Wordpress without involving http requests...');

  // Connect to Wordpress API
  wp.posts()
    .type('content')
    .filter('posts_per_page', -1)
    .get(function (err, data) {
      if (!err) {

        console.log('Found ' + data.length + ' contents');

        // Group by types (is there a faster module than Lodash?)
        data = _.groupBy(data, function (content) {
          var slug,
              types = content.terms.types;

          if (types && types[0]) {

            switch (types[0].slug) {
              case 'contribuciones-al-debate': slug = 'contributions'; break;
              case 'emblemas': slug = 'emblems'; break;
              case 'ensayos': slug = 'essays'; break;
              case 'estudios-de-vocabulario': slug = 'studies'; break;
              case 'lemas': slug = 'lemmas'; break;
              case 'paginas': slug = 'pages'; break;

              default: slug = types[0].slug;
            }

            return slug;
          }
        });

        // Generate relations between contents
        for(var type in data) {
          if (type !== 'pages') {
            _(data[type]).forEach(function (d, i) {
              var content = d.content;

              _(data[type]).forEach(function (t) {
                var pattern = new RegExp(t.title, 'gi');
                content = content.replace(pattern, function(word) {
                  if (t.terms.types && t.terms.types[0]) {
                    return '<a href="#/' + type + '/' + t.ID + '">'+ word +'</a>';
                  }

                  return word;
                });
              });

              data[type][i].content = content;
            });
          }
        };

        // Set content by types
        server.set('contents', data);
      }
    });
};

// Get data from Wordpress hourly
setInterval(getDataFromWordpress, 1 * 60 * 60 * 1000);
getDataFromWordpress();


// Main route
server.get('/', function (req, res) {
  res.render('index');
});


// Endpoints
//

// Contents (all types)
server.get('/api/1.0/types', function (req, res) {
  res.json(server.get('contents'));
});

// Contents (by id)
server.get('/api/1.0/types/:type/:id', function (req, res) {
  var contents = server.get('contents'),
      content = _.where(contents[req.params.type], {
        'ID': parseInt(req.params.id, 10)
      });

  res.json(content[0]);
});

// Contents (by type)
['contributions', 'emblems', 'essays', 'studies', 'lemmas', 'pages'].forEach(function (slug) {
  server.get('/api/1.0/types/' + slug, function (req, res) {
    var contents = server.get('contents');
    res.json(contents[slug]);
  });
});


// Start server
if (!module.parent) {
  server.listen(process.env.PORT || config.port);
}
