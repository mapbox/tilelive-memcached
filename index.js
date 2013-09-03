var util = require('util');
var Memcached = require('memcached');

module.exports = function(options, Source) {
    if (!Source) throw new Error('No source provided');
    if (!Source.prototype.get) throw new Error('No get method found on source');

    options = options || {};
    var client = options.client || new Memcached('127.0.0.1:11211');
    var expires = options.expires || 300;

    function Caching() { return Source.apply(this, arguments) };

    // Inheritance.
    util.inherits(Caching, Source);

    // References for testing, convenience.
    Caching.memcached = {};
    Caching.memcached.client = client;
    Caching.memcached.expires = expires;

    Caching.prototype.get = function(url, callback) {
        var key = 'TL-' + url;
        var source = this;
        client.get(key, function(err, encoded) {
            // If error on memcached get, pass through to original source
            // without attempting a set after retrieval.
            if (err) {
                err.key = key;
                client.emit('error', err);
                return Source.prototype.get.call(source, url, callback);
            }

            // Cache hit.
            if (encoded) try {
                var data = decode(encoded);
                return callback(data.err, data.buffer, data.headers);
            } catch(err) {
                err.key = key;
                client.emit('error', err);
            }

            // Cache miss, error, or otherwise no data
            Source.prototype.get.call(source, url, function(err, buffer, headers) {
                if (err && err.status !== 404 && err.status !== 403) return callback(err);
                callback(err, buffer, headers);
                // Callback does not need to wait for memcached set to occur.
                client.set(key, encode(err, buffer, headers), expires, function(err) {
                    if (!err) return;
                    err.key = key;
                    client.emit('error', err);
                });
            });
        });
    };

    // Carmen search method.
    // @TODO deprecate this in future versions of carmen which should be able
    // to use the generic get method above.
    if (Source.prototype.search) Caching.prototype.search = function(query, id, callback) {
        var url = (this.data && this.data._carmen) || 'NOCARMEN';
        var key = 'TL-search-' + url + (id ? '-id-' + encodeURI(id) : '-query-' + encodeURI(query));
        var source = this;
        client.get(key, function(err, encoded) {
            if (err) {
                err.key = key;
                client.emit('error', err);
                return Source.prototype.search.call(source, query, id, callback);
            }

            // Cache hit.
            if (encoded) try {
                var data = JSON.parse(encoded);
                return callback(null, data);
            } catch(err) {
                err.key = key;
                client.emit('error', err);
            }

            // Cache miss, error, or otherwise no data
            Source.prototype.search.call(source, query, id, function(err, data) {
                if (err) return callback(err);
                callback(err, data);
                // Callback does not need to wait for memcached set to occur.
                client.set(key, JSON.stringify(data), expires, function(err) {
                    if (!err) return;
                    err.key = key;
                    client.emit('error', err);
                });
            });
        });
    };

    // Carmen feature method.
    // @TODO deprecate this in future versions of carmen which should be able
    // to use the generic get method above.
    if (Source.prototype.feature) Caching.prototype.feature = function(id, callback, raw) {
        var url = (this.data && this.data._carmen) || 'NOCARMEN';
        var key = 'TL-feature-' + url + (raw ? '-raw-' : '') + encodeURI(id);
        var source = this;
        client.get(key, function(err, encoded) {
            if (err) {
                err.key = key;
                client.emit('error', err);
                return Source.prototype.search.call(source, query, id, callback);
            }

            // Cache hit.
            if (encoded) try {
                var data = JSON.parse(encoded);
                return callback(null, data);
            } catch(err) {
                err.key = key;
                client.emit('error', err);
            }

            // Cache miss, error, or otherwise no data
            Source.prototype.feature.call(source, id, function(err, data) {
                if (err) return callback(err);
                callback(err, data);
                // Callback does not need to wait for memcached set to occur.
                client.set(key, JSON.stringify(data), expires, function(err) {
                    if (!err) return;
                    err.key = key;
                    client.emit('error', err);
                });
            }, raw);
        });
    };

    return Caching;
};

module.exports.Memcached = Memcached;
module.exports.encode = encode;
module.exports.decode = decode;

function encode(err, buffer, headers) {
    if (err && err.status === 404) return '404';
    if (err && err.status === 403) return '403';

    // Unhandled error.
    if (err) throw new Error('Error could not be encoded: ' + err.message);

    // Turn strings into buffers.
    if (buffer && !(buffer instanceof Buffer)) buffer = new Buffer(buffer);

    return JSON.stringify(headers || {}) + buffer.toString('base64');
};

function decode(encoded) {
    if (encoded === '404' || encoded === '403') {
        var err = new Error();
        err.status = parseInt(encoded, 10);
        err.memcached = true;
        return { err: err };
    }

    var breaker = encoded.indexOf('}');
    if (breaker === -1) return new Error('Invalid cache value');

    var data = {};
    data.headers = JSON.parse(encoded.substr(0, breaker+1));
    data.headers['x-memcached'] = 'hit';
    data.buffer = new Buffer(encoded.substr(breaker), 'base64');
    return data;
};

