'use strict';

// Modules
const webpack = require('webpack');

module.exports = {
  entry: './app/src/nes.js',
  output: {
    path: './dist',
    filename: 'nes.bundle.js',
  },
  devServer: {
    contentBase: './app',
    stats: 'minimal'
  },
  module: {
    loaders: [{
      // js loader
      // transpile ES6 to ES5
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel-loader'
    },

    {
      test: /\.css$/,
      loader: "style-loader!css-loader"
    },
    {
      test: /\.scss$/,
      loader: "style-loader!css-loader!sass-loader"
    },

    {
      // HTML loader
      test: /\.html$/,
      loader: 'raw-loader'
    },
    {
      test: /\.(png|jpg|jpeg|gif)$/,
      loader: 'file-loader'
    }]
  }
};
