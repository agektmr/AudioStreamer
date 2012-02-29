/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', {
    title: 'Express',
    WS_HOST: WS_HOST
  });
};