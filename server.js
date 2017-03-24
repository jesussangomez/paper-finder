var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var phantom = require('phantom');

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

var port = process.env.PORT || 8080
var router = express.Router()

router.get('/', function(req, res) {
  res.json({ message: 'Paper Finder API v1.0' })
})

router.route('/ieee')
  .post(function (req, res) {
    var term = req.body.term
    var sort = req.body.sort
    var page = req.body.page

    var baseURL = 'http://ieeexplore.ieee.org/search/searchresult.jsp?'
    var url = baseURL + 'queryText=' + term
      + '&rowsPerPage=10&pageNumber=' + page
    if (sort != 'relevance')
      url += '&sortType=' + sort

    phantom.create(['--ignore-ssl-errors=yes', '--load-images=no'], {
      phantomPath: './node_modules/phantomjs-prebuilt/bin/phantomjs'
    })
      .then(instance => {
        phInstance = instance;
        return instance.createPage();
      })
      .then(p => {
        page = p;
        return page.open(url);
      })
      .then(status => {
        return page.includeJs('https://ajax.googleapis.com/ajax/libs/jquery/1.12.2/jquery.min.js');
      })
      .then(status => {
        return page.evaluate(function() {
          var articles = []
          $('.pure-u-22-24').each(function () {
            var listOfAuthors = $(this).find('p span')
            var authors = []
            listOfAuthors.each(function () {
              var author = $(this).find('a span').text()
              if (author !== '')
                authors.push(author)
            })
            var description = $(this).find('.description').text()
            var abstract = $(this).find('.stats-SearchResults_DocResult_ViewMore .ng-binding').text()
            var url = $(this).find('.stats-SearchResults_DocResult_ViewMore a').attr('href')
            var article = {
              'title': $(this).find('h2 a').text(),
              'authors': authors,
              'description': description,
              'abstract': abstract,
              'url': 'http://ieeexplore.ieee.org' + url
            }
            articles.push(article)
          })
          return articles;
        });
      })
      .then(articles => {
        var arts = JSON.stringify(articles)
        res.json(articles)
        phInstance.exit();
        return true;
      })
      .catch(error => {
          console.log(error);
          phInstance.exit();
      });
  })

app.use('/api', router)

app.listen(port)
console.log('API listening on port ' + port);
