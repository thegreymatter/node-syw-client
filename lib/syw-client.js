'use strict';

/**
 * Module dependencies
 */
var url = require('url');
var request = require('request');
var extend = require('deep-extend');
var sha256 = require('js-sha256');

function SywClient(options) {
  if (!(this instanceof SywClient)) { return new SywClient(options) }

  // Merge the default options with the client submitted options
  this.options = extend({
    token: null,
    app_secret: null,
    offline_token: null,
    offline_hash: null,
    base_url: 'https://platform.shopyourway.com',
    request_options: {
      headers: {
        Accept: '*/*',
        Connection: 'close'
      }
    }
  }, options);

  // Default to user authentication
  var authentication_options = {
    oauth: {
      consumer_key: this.options.consumer_key,
      consumer_secret: this.options.consumer_secret,
      token: this.options.access_token_key,
      token_secret: this.options.access_token_secret
    }
  };

  // Configure default request options
  this.request = request.defaults(
    extend(
      this.options.request_options,
      authentication_options
    )
  );

  // Check if Promise present
  this.allow_promise = (typeof Promise === 'function');
}

SywClient.prototype.__generateHash = function(token,appSecret) {
  var hash = sha256.create();
  hash.update(token).update(appSecret);
  return hash.hex();
};

SywClient.prototype.__buildEndpoint = function(path,base_url) {
  var endpoint = base_url;
  // if full url is specified we use that
  var isFullUrl = (url.parse(path).protocol !== null);
  if (isFullUrl) {
    endpoint = path;
  }
  else {
    endpoint += (path.charAt(0) === '/') ? path : '/' + path;
  }

  // Remove trailing slash
  endpoint = endpoint.replace(/\/$/, '');

  return endpoint;
};

SywClient.prototype.__request = function(method, path, params, callback) {
  var promise = false;

  // Set the callback if no params are passed
  if (typeof params === 'function') {
    callback = params;
    params = {};
  }
  // Return promise if no callback is passed and promises available
  else if (callback === undefined && this.allow_promise) {
    promise = true;
  }

  if( this.options.token ){
    params.token = this.options.token;
    params.hash = this.__generateHash(this.options.token,this.options.app_secret);
  }
  else if (this.options.offline_token) {
    params.token = this.options.offline_token;
    params.hash = this.options.offline_hash;
  }

  // Build the options to pass to our custom request object
  var options = {
    method: method.toLowerCase(),  // Request method - get || post
    url: this.__buildEndpoint(path,this.options.base_url) // Generate url
  };

  // Pass url parameters if get
  if (method === 'get') {
    options.qs = params;
  }

  // Pass form data if post
  if (method === 'post') {
    var formKey = 'form';

    if (typeof params.media !== 'undefined') {
      formKey = 'formData';
    }
    options[formKey] = params;
  }

  // Promisified version
  if (promise) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.request(options, function(error, response, data) {
        // request error
        if (error) {
          return reject(error);
        }

        // JSON parse error or empty strings
        try {
          // An empty string is a valid response
          if (data === '') {
            data = {};
          }
          else {
            data = JSON.parse(data);
          }
        }
        catch(parseError) {
          return reject(new Error('JSON parseError with HTTP Status: ' + response.statusCode + ' ' + response.statusMessage));
        }

        // response object errors
        // This should return an error object not an array of errors
        if (data.errors !== undefined) {
          return reject(data.errors);
        }

        // status code errors
        if(response.statusCode < 200 || response.statusCode > 299) {
          return reject(new Error('HTTP Error: ' + response.statusCode + ' ' + response.statusMessage));
        }

        // no errors
        resolve(data);
      });
    });
  }

  // Callback version
  this.request(options, function(error, response, data) {
    // request error
    if (error) {
      return callback(error, data, response);
    }

    // JSON parse error or empty strings
    try {
      // An empty string is a valid response
      if (data === '') {
        data = {};
      }
      else {
        data = JSON.parse(data);
      }
    }
    catch(parseError) {
      return callback(
        new Error('JSON parseError with HTTP Status: ' + response.statusCode + ' ' + response.statusMessage),
        data,
        response
      );
    }


    // response object errors
    // This should return an error object not an array of errors
    if (data.errors !== undefined) {
      return callback(data.errors, data, response);
    }

    // status code errors
    if(response.statusCode < 200 || response.statusCode > 299) {
      return callback(
        new Error('HTTP Error: ' + response.statusCode + ' ' + response.statusMessage),
        data,
        response
      );
    }
    // no errors
    callback(null, data, response);
  });

};

/**
 * GET
 */
SywClient.prototype.get = function(url, params, callback) {
  return this.__request('get', url, params, callback);
};

/**
 * POST
 */
SywClient.prototype.post = function(url, params, callback) {
  return this.__request('post', url, params, callback);
};

module.exports = SywClient;
