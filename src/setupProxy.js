const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/rte',
    createProxyMiddleware({
      target: 'https://agora-token-service-07fo.onrender.com',
      changeOrigin: true,
    })
  );
};