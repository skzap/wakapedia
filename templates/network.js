var Ractive = require( 'ractive' )

Wakapedia.Templates.Network = new Ractive({
  el: '#network',
  template: '#tNetwork',
  data: {connected: 0},
  refresh: function() {
    Waka.mem.Peers.find({},{}).fetch(function(res){
      Wakapedia.Templates.Network.set('connected', res.length)
      Wakapedia.Templates.Network.set('myId', Waka.c.id)
      var articles = []
      for (var i = 0; i < res.length; i++) {
        if (!res[i].index) continue
        for (var y = 0; y < res[i].index.length; y++) {
          if (articles.indexOf(res[i].index[y].title) == -1)
            articles.push(res[i].index[y].title)
        }
      }
      Wakapedia.Templates.Network.set('articles', articles)
      var articles = []
      Waka.db.Articles.find({},{fields: {_id:1, title: 1}}).fetch(function(res){
        Wakapedia.Templates.Network.set('myarticles', res)
      })
    })
  }
})
