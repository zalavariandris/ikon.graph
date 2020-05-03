const path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devServer: {
    host: '0.0.0.0',//your ip address
    port: 8080,
    disableHostCheck: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'IKON.graph'
    })
  ],
  module: {
  	rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.glsl$/i,
        use: 'raw-loader'
      }
    ],
  }
};


