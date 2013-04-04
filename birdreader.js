// load the config
var config = require("./includes/config.js").get;

// we need access to the articles  and feeds databases on Cloudant
var article = require('./includes/article.js');
var feed = require('./includes/feed.js');

// we need the express framework
var express = require('express');
var app = express();

// async library
var async = require('async');

// Authenticator
if(config.authentication && config.authentication.on) {
  app.use(express.basicAuth( config.authentication.username, config.authentication.password));
}

// Purge older articles
if(config.purgeArticles && config.purgeArticles.on && config.purgeArticles.purgeBefore>0) {
  setInterval(function() { article.purge(config.purgeArticles.purgeBefore,function(err,data) { } ) }, 1000*60*60*24);
}

// fetch articles every 5 minutes
setInterval(function() { feed.fetchArticles(function(err,results) { console.log("Fetched articles")}) }, 1000*60*5);

// fire up the jade engine
app.engine('jade', require('jade').__express);

// use compression where appropriate
app.use(express.compress());

// server out our static directory as static files
app.use(express.static(__dirname+'/public'));

// home
app.get('/', function(req, res) {
  res.statusCode = 302;
  res.setHeader('Location', '/unread');
  res.end('This page has moved');
});

// unread articles
app.get('/unread', function(req, res) {
  
  async.parallel([
    function(callback) {
      article.stats(callback);
    },
    function(callback) {
      article.unreadArticles(callback);
    }
  ], function(err,results) {
    res.render('index.jade', { title: "Unread", type:"unread", stats:results[0], articles: results[1] } );
  });

});

// read articles
app.get('/read', function(req, res) {
  
  async.parallel([
    function(callback) {
      article.stats(callback);
    },
    function(callback) {
      article.readArticles(callback);
    }
  ], function(err,results) {
      res.render('index.jade', {title:'Read', type:"read", stats:results[0], articles: results[1]} );
  });

});

// starred articles
app.get('/starred', function(req, res) {
  
  async.parallel([
    function(callback) {
      article.stats(callback);
    },
    function(callback) {
      article.starredArticles(callback);
    }
  ], function(err,results) {
      res.render('index.jade', {title: 'Starred', type:"starred", stats:results[0], articles: results[1]} );
  });

});


// search 
app.get('/search', function(req,res) {
  async.parallel([
    function(callback) {
      article.stats(callback);
    },
    function(callback) {
      article.search(req.query.keywords,callback);
    }
  ], function(err,results) {
      res.render('index.jade', {title: 'Search "'+req.query.keywords+'"', type:"search", stats:results[0], articles: results[1]} );
  });
})

// get raw unread articles
app.get('/api/unread', function(req,res) {
  
  article.unreadArticles(function(err,data) {
    res.send(data);
  });;

});

// get raw read articles
app.get('/api/read', function(req,res) {
  
  article.readArticles(function(err,data) {
    res.send(data);
  });;

});

// get raw starred articles
app.get('/api/starred', function(req,res) {
  
  article.starredArticles(function(err,data) {
    res.send(data);
  });;

});

// get raw search results
app.get('/api/search', function(req,res) {
  
  article.search(req.query.keywords,function(err,data) {
    res.send(data);
  });;

});

// mark an article read
app.get('/api/:id/read', function(req,res) {
  
  // mark the supplied article as read
  article.markRead(req.params.id,function(data) { 
      res.send(data)
  });
})

// star an article 
app.get('/api/:id/star', function(req,res) {
  
  // mark the supplied article as starred
  article.star(req.params.id,function(data) { 
      res.send(data)
  });
})

// unstar an article 
app.get('/api/:id/unstar', function(req,res) {
  
  // mark the supplied article as un-starred
  article.unstar(req.params.id,function(data) { 
      res.send(data)
  });
})

// add a new feed api call, expects 'url' get parameter
app.get('/api/feed/add', function(req,res) {
  
  // Add the new feed to the database
  feed.add(req.query.url,function(err,data){
    res.send(data);
  })
})


var byTagApi= function(type,req,res) {
  var tag = req.params.tag.toLowerCase();
  
  article.articlesByTag(type,tag,function(err,data) {
    res.send(data);
  });

}

app.get("/api/read/bytag/:tag", function(req,res) {
  byTagApi("read",req,res);
}); 

app.get("/api/unread/bytag/:tag", function(req,res) {
  byTagApi("unread",req,res);
});

app.get("/api/starred/bytag/:tag", function(req,res) {
  byTagApi("starred",req,res);
});


// add form articles
app.get('/add', function(req, res) {
  
  // fetch the article stats
  article.stats(function(err,stats) {
    
    // render the page
    res.render('addform.jade', {title: 'Add', stats: stats});
  });

});

// feeds list
app.get('/feeds', function(req, res) {
  
  // fetch the article stats
  article.stats(function(err,stats) {
    // fetch the article stats
    feed.readAll(function(feeds) {
    
      // render the page
      res.render('feeds.jade', {title: 'Feeds', feeds: feeds, stats: stats});
    });
  });

});

// individual feed
app.get('/feed/:id', function(req, res) {
  
  async.parallel([
    function(callback) {
      article.stats(callback);
    },
    function(callback) {
      feed.get(req.params.id, function(err,data) {
        callback(err,data);
      });
    }
  ], function(err,results) {
      res.render('feed.jade', {title: 'Feed', feed: results[1], stats: results[0], id: req.params.id});
  });

});

app.get('/api/feeds', function(req,res) {
  feed.readAll(function(data) {
    res.send(data);
  });
});

app.get('/api/feed/:id', function(req,res) {
  feed.get(req.params.id,function(err,data) {
    res.send(data);
  });
});

// add a tag to a feed
app.get('/api/feed/:id/tag/add', function(req, res) {
  
  feed.addTag(req.params.id,req.query.tag,function(err,data) {
    res.send({ success: !err, data: data});
  })
  
});

// remove a tag from a feed
app.get('/api/feed/:id/tag/remove', function(req, res) {
  
  feed.removeTag(req.params.id,req.query.tag,function(err,data) {
    res.send({ success: !err, data: data});
  })
  
});

// remove a feed
app.get('/api/feed/:id/remove', function(req, res) {
  
  feed.remove(req.params.id,function(err,data) {
    res.send({ success: !err, data: data});
  })

});

var byTag= function(type,req,res) {
  var tag = req.params.tag.toLowerCase();
  
  async.parallel([
    function(callback) {
      article.stats(callback);
    },
    function(callback) {
      article.articlesByTag(type,tag,callback);
    }
  ], function(err,results) {
      res.render('index.jade', {title: type+' by tag '+tag, type:type, stats:results[0], articles: results[1]} );
  });
}

app.get("/read/bytag/:tag", function(req,res) {
  byTag("read",req,res);
}); 

app.get("/unread/bytag/:tag", function(req,res) {
  byTag("unread",req,res);
});

app.get("/starred/bytag/:tag", function(req,res) {
  byTag("starred",req,res);
});

// listen on port 3000
app.listen(3000);
console.log('Listening on port 3000');


