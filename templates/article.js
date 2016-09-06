var Ractive = require( 'ractive' )

Wakapedia.Templates.Article = new Ractive({
  el: '#article',
  template: '#tArticle',
  data: {
    hidden: true,
    shortId: function(longId) {
      if(!longId) return
      return longId.substr(0,4)
    }
  },
  displayAndSearch: function(title, noWiki) {
    Wakapedia.Templates.Article.set('hidden', false)
    var re = new RegExp("^"+title+"$", 'i');
    // search on waka
    Waka.api.Search(title)
    Waka.db.Articles.findOne({title: re}, {}, function(art) {
      if (art) Wakapedia.Templates.Article.refreshArticleTemplate(art)
      else {
        // no match in our local db
        // search on wiki
        if (!noWiki)
          WikipediaApi.getExtract(title, function(err, res) {
            for (var key in res.pages) {
              if (res.pages[key].missing == '') break
              res.pages[key].extract = WikipediaApi.convertWikiToMd(res.pages[key].extract)
              res.pages[key].extract = WikipediaApi.addLinks(res.pages[key].extract, res.pages[key].links, [title])
              res.pages[key].extractHtml = Wakapedia.Syntax(res.pages[key].extract)
              Wakapedia.Templates.Article.set('wiki', res.pages[key])
              if (res.pages[key].title.toLowerCase() != title.toLowerCase()) {
                Wakapedia.Templates.Article.displayAndSearch(res.pages[key].title, true)
              }
            }
          })
      }
    })
  },
  reset: function() {
    Wakapedia.Templates.Article.set('article', null)
    Wakapedia.Templates.Article.set('wiki', null)
    Wakapedia.Templates.Article.set('variants', null)
    Wakapedia.Templates.Article.set('variant', null)
  },
  refreshArticleTemplate: function(article) {
    // converting md to html
    article.contentHtml = Wakapedia.Syntax(article.content.text)
    Wakapedia.Templates.Article.set('article', article)
    Wakapedia.Templates.Article.RemoveIframes()

    // redirection
    if (article.content.text.substr(0,2) == '[[' && article.content.text.substr(article.content.text.length-2, 2) == ']]')
      Wakapedia.Templates.Article.displayAndSearch(article.content.text.substr(2,article.content.text.length-4), true)
  },
  // searchForArticle: function(title) {
  //   console.log('Searching for',title)
  //   Waka.mem.Search.find({origin: Waka.c.id},{}).fetch(function(s) {
  //     for (var i = 0; i < s.length; i++) {
  //       Waka.mem.Search.remove(s[i]._id)
  //     }
  //   })
  //   Waka.mem.Search.upsert({title: title, origin: Waka.c.id})
  //   Waka.c.broadcast({
  //     c:'search',
  //     data: {title: title, origin: Waka.c.id, echo: 2}
  //   })
  // },
  createFromWiki: function() {
    var params = window.location.hash.split('#')
    var searchTitle = params[1]
    //searchTitle = searchTitle.replace(/_/g," ")
    var wiki = Wakapedia.Templates.Article.get('wiki')
    if (wiki.title.toLowerCase() != searchTitle.toLowerCase())
      Wakapedia.AddNewRedirect(searchTitle, wiki.title, function(){})
    if (wiki.thumbnail && wiki.thumbnail.original)
      Wakapedia.AddNewArticle(wiki.title, wiki.extract, wiki.thumbnail.original, function(e,r) {
        Wakapedia.Templates.Article.refreshArticleTemplate(r.triplet)
      })
    else
      Wakapedia.AddNewArticle(wiki.title, wiki.extract, null, function(e,r) {
        Wakapedia.Templates.Article.refreshArticleTemplate(r.triplet)
      })
  },
  createBlankArticle: function() {
    var params = window.location.hash.split('#')
    var title = params[1]
    Wakapedia.AddNewArticle(title, '', null, function(e,r) {
      Wakapedia.Templates.Article.refreshArticleTemplate(r.triplet)
    })
  },
  switchEditMode: function() {
    Wakapedia.Templates.Article.set('edit', !Wakapedia.Templates.Article.get('edit'))
  },
  checkVariants: function(cb) {
    var article = Wakapedia.Templates.Article.get('article')
    var title = article.title
    if (!title) return
    Waka.mem.Peers.find({'index.title': title},{}).fetch(function(peers){
      if (!peers) cb('No peers indexed this article')
      var result = {
        title: title,
        peers: peers.length,
        variants: []
      }
      for (var i = 0; i < peers.length; i++) {
        for (var y = 0; y < peers[i].index.length; y++) {
          if (peers[i].index[y].title == title) {
            var exists = false
            for (var v = 0; v < result.variants.length; v++) {
              if (peers[i].index[y]._id == result.variants._id) {
                exists = true
                result.variants[v].count++
              }
            }
            if (!exists) {
              Waka.mem.Variants.findOne({_id: peers[i].index[y]._id},{},function(match){
                var variant = {
                  _id: peers[i].index[y]._id,
                  count: 1
                }
                if (match) variant.downloaded = true
                if (variant._id == Wakapedia.Templates.Article.get('article._id')) variant.current = true
                result.variants.push(variant)
              })
            }
          }
        }
      }
      cb(null, result)
    })
  },
  showVariants: function() {
    Wakapedia.Templates.Article.checkVariants(function(e,r){
      Wakapedia.Templates.Article.set('variants', r.variants)
    })
  },
  saveArticle: function() {
    var currentArticle = Wakapedia.Templates.Article.get().article
    if (!currentArticle) return
    Wakapedia.AddNewArticle(currentArticle.title, $('#editContent').val(), $('#editImage').val(), function(e,r) {
      Wakapedia.Templates.Article.refreshArticleTemplate(r.triplet)
    })
  },
  compareVariant: function(event) {
    if (Wakapedia.Templates.Article.get('variant.isCompare')) {
      Wakapedia.Templates.Article.set('variant.isCompare', false)
      return
    }
    Waka.mem.Variants.findOne({_id: event.context._id}, {}, function(variant){
      variant.contentHtml = Wakapedia.Syntax(variant.content.text)
      var dmp = new diff_match_patch();
      var d = dmp.diff_main(Wakapedia.Templates.Article.get('article.content.text'), variant.content.text);
      dmp.diff_cleanupSemantic(d);
      variant.diffString = dmp.diff_prettyHtml(d);
      if (Wakapedia.Templates.Article.get('article.content.image') != variant.content.image)
        variant.imageChange = {
          old: Wakapedia.Templates.Article.get('article.content.image')
        }
      variant.isCompare = true
      Wakapedia.Templates.Article.set('variant', variant)
    })
  },
  previewVariant: function(event) {
    if (Wakapedia.Templates.Article.get('variant.isPreview')) {
      Wakapedia.Templates.Article.set('variant.isPreview', false)
      return
    }
    Waka.mem.Variants.findOne({_id: event.context._id}, {}, function(variant){
      variant.contentHtml = Wakapedia.Syntax(variant.content.text)
      variant.isPreview = true
      Wakapedia.Templates.Article.set('variant', variant)
    })
  },
  adoptVariant: function(event) {
    Waka.mem.Variants.findOne({_id: event.context._id}, {}, function(variant){
      Wakapedia.AddNewArticle(variant.title, variant.content.text, variant.content.image, function(e,r) {
        Wakapedia.Templates.Article.refreshArticleTemplate(r.triplet)
      })
    })
  },
  downloadVariant: function(event) {
    Waka.mem.Search.upsert({variant: event.context._id, origin:Waka.c.id})
    Waka.mem.Peers.find({'index._id': event.context._id},{}).fetch(function(peers){
      for (var i = 0; i < peers.length; i++) {
        Waka.c.messageToPeer(peers[i]._id, {c:'download', data: {_id:event.context._id, origin: Waka.c.id}})
      }
    })
  },
  resetDisplaySearch: function(title) {
    Wakapedia.Templates.Article.reset()
    Wakapedia.Templates.Article.displayAndSearch(title)
  },
  RemoveIframes: function() {
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
        iframes[i].parentNode.removeChild(iframes[i]);
    }
  }
})

Wakapedia.Templates.Article.on({
  createFromWiki: Wakapedia.Templates.Article.createFromWiki,
  editArticle: Wakapedia.Templates.Article.switchEditMode,
  showVariants: Wakapedia.Templates.Article.showVariants,
  saveArticle: Wakapedia.Templates.Article.saveArticle,
  compareVariant: Wakapedia.Templates.Article.compareVariant,
  previewVariant: Wakapedia.Templates.Article.previewVariant,
  adoptVariant: Wakapedia.Templates.Article.adoptVariant,
  downloadVariant: Wakapedia.Templates.Article.downloadVariant,
  createBlankArticle: Wakapedia.Templates.Article.createBlankArticle
})
