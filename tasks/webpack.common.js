const webpack = require('webpack');
const path = require("path");

module.exports = {
  entry: [
    './origoiframeetuna.js'
  ],
  module: {
    rules: [{
      test: /\.(js)$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
      query: {
        cacheDirectory: false,
        presets: [
          ['@babel/preset-env', {
            targets: {
              browsers: ['chrome >= 39']
            },
            modules: false,
            useBuiltIns: 'usage',
            corejs: "3.22"
          }]
        ],
        plugins: [
          ['@babel/plugin-transform-runtime', {
            regenerator: true,
            corejs: 2
          }]
        ]
      }
    }]
  },
  externals: ['Origo'],
  resolve: {
    extensions: ['*', '.js', '.scss'],
    alias: {
      'Origo$': path.resolve(__dirname, "../../origo/origo.js")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      fetch: 'imports-loader?this=>global!exports-loader?global.fetch!whatwg-fetch'
    })
  ]
};
