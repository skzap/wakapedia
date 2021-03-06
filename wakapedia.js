require('../waka2/waka.js')
var Config = require('./config.json')
var Ractive = require( 'ractive' )
var marked = require('marked')
Ractive.DEBUG = false
require('./wikipedia-api.js')

Waka.connect(Config.SignalServer)

Wakapedia = {
  Syntax: function(content) {
    //var contentHtml = marked(content)
    var contentCopy = content
    // extra syntax
    // [[ ]] Double matching brackets wiki style
    var words = []
    var wordsMarkdown = []
    while (contentCopy.indexOf('[[') > -1 && contentCopy.indexOf(']]') > -1) {
      words.push(contentCopy.substring(contentCopy.indexOf('[['), contentCopy.indexOf(']]')+2))
      contentCopy = contentCopy.substr(contentCopy.indexOf(']]')+2)
    }
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf('|') > -1) {
        var link = words[i].substring(2, words[i].indexOf('|'))
        var display = words[i].substring(words[i].indexOf('|')+1, words[i].length-2)
        wordsMarkdown.push('['+display+'](#'+link+')')
      }
      else
        wordsMarkdown.push('['+words[i].substring(2, words[i].length-2)+'](#'+words[i].substring(2, words[i].length-2)+')')
      content = content.replace(words[i], wordsMarkdown[i])
    }
    return marked(content)
  },
  AddNewArticle: function(title, content, image, timestampAuthority, signingKey, cb) {
    var options = {}
    if (timestampAuthority) options.timestampAuthority = timestampAuthority
    if (signingKey) options.signingKey = signingKey
    Waka.api.Set(title, {text: content, image: image}, options, function(e,r) {
      cb(e,r)
    })
  },
  AddNewRedirect: function(titleFrom, titleTo, cb) {
    Wakapedia.AddNewArticle(titleFrom, '[['+titleTo+']]', null, null, null, function(e,r){
      cb(e,r)
    })
  },
  CheckUrlHash: function() {
    params = window.location.hash.split('#')
    if (params[1]) {
      //params[1] = params[1].replace(/_/g," ")
      Wakapedia.Templates.Article.resetDisplaySearch(params[1])
    } else {
      window.location.hash = '#' + Config.DefaultArticle
    }
  },
  Templates: {}
}
require('./templates/article.js')
require('./templates/network.js')

// Plug Waka Events
Waka.api.Emitter.on('connected', listener = function(){
  Wakapedia.CheckUrlHash()
})
Waka.api.Emitter.on('peerchange', listener = function(){
  Wakapedia.Templates.Network.refresh()
  Wakapedia.Templates.Article.showVariants()
})
Waka.api.Emitter.on('newshare', listener = function(article){
  Wakapedia.Templates.Article.refreshArticleTemplate(article)
})
Waka.api.Emitter.on('newsharevar', listener = function(article){
  Wakapedia.Templates.Article.showVariants()
})

// search feature
$( "#search" ).submit(function( event ) {
  window.location.hash = '#' + event.target.title.value
  event.preventDefault();
});

$(window).on('hashchange', function() {
  Wakapedia.CheckUrlHash()
});
