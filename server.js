require('dotenv-extended').load()

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

router.route('/scopus')
  .get(function (req, res) {
    var type = req.query.type
    var baseURL ='http://api.elsevier.com/content/search/'
    var query = type + '?query=' + req.query.query

    var url = baseURL + query

    console.log(url);

    var options = {
      url: url,
      method: 'GET',
      headers: {
        'X-ELS-APIKey': process.env.SCOPUS_API_KEY
      },
      json: true
    }

    var request = require('request');
    request(options, function (error, response, body) {
      res.send(body);
    });
  })

router.route('/ieeexplore')
  .post(function (req, res) {
    var baseURL = 'http://ieeexplore.ieee.org/gateway/ipsSearch.jsp?'
    var query = (req.body.query) ? ('&querytext=' + req.body.query): ''
    var author = (req.body.author) ? ('&au=' + req.body.author): ''
    var searchQueries = query + author

    var url = baseURL + searchQueries.substring(1)

    var request = require('request');
    request(url, function (error, response, body) {
      var parseString = require('xml2js').parseString;
      parseString(body, function (err, result) {
        var docs = result.root.document
        var papers = []

        docs.forEach(doc => {
          var paper = {
            'title': doc.title[0],
            'authors': doc.authors[0].split('; '),
            'affiliations': doc.affiliations[0],
            'keywords': doc.controlledterms[0].term,
            'pubtitle': doc.pubtitle[0],
            'pubnumber': doc.punumber[0],
            'pubtype': doc.pubtype[0],
            'publisher': doc.publisher[0],
            'py': doc.py[0],
            'pages': [doc.spage[0], doc.epage[0]],
            'abstract': doc.abstract[0],
            'isbn': (doc.isbn) ? doc.isbn[0] : '',
            'issn': (doc.issn) ? doc.issn[0] : '',
            'doi': doc.doi[0],
            'pdf': doc.pdf[0]
          }
          papers.push(paper)
        })

        var data = {
          'found': result.root.totalfound[0],
          'searched': result.root.totalsearched[0],
          'papers': papers
        }

        res.json(data)
      });
    });
  })

router.route('/ieeescraper')
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
