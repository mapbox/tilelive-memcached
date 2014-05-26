var urlParse = require('url').parse;
var util = require('util');
var Memcached = require('memcached');

module.exports = function(options, Source) {
    if (!Source) throw new Error('No source provided');
    if (!Source.prototype.get) throw new Error('No get method found on source');

    options = options || {};
    options.client = ('client' in options) ? options.client : new Memcached('127.0.0.1:11211');
    options.expires = ('expires' in options) ? options.expires : 300;
    options.mode = ('mode' in options) ? options.mode : 'readthrough';

    function Caching() { return Source.apply(this, arguments) };

    // Inheritance.
    util.inherits(Caching, Source);

    // References for testing, convenience, post-call overriding.
    Caching.memcached = options;

    if (options.mode === 'readthrough') {
        Caching.prototype.get = readthrough;
    } else if (options.mode === 'race') {
        Caching.prototype.get = race;
    }

    function race(url, callback) {
        if (!options.client) return callback(new Error('No memcached client'));
        if (!options.expires) return callback(new Error('No expires option set'));

        var key = 'TL-' + url;
        var source = this;
        var client = options.client;
        var expires;
        if (typeof options.expires === 'number') {
            expires = options.expires;
        } else {
            expires = options.expires[urlParse(url).hostname] || options.expires.default || 300;
        }

        // The first op to finish will flip this flag.
        var first = true;

        var cached = null;
        var current = null;

        // GET upstream.
        Source.prototype.get.call(source, url, function(err, buffer, headers) {
            current = encode(err, buffer, headers);
            if (!first) {
                finalize();
            } else if (err && err.status !== 404 && err.status !== 403) {
                callback(err);
            } else {
                callback(err, buffer, headers);
            }
            first = false;
        });

        // GET memcached.
        client.get(key, function(err, encoded) {
            // If error on memcached, do not flip first flag.
            // Finalize will never occur (no cache set).
            if (err) return (err.key = key) && client.emit('error', err);

            cached = encoded;
            if (!first) {
                finalize();
            } else if (encoded) {
                var data
                try { decode(encoded); }
                catch(err) { (err.key = key) && client.emit('error', err); }
                if (data) callback(data.err, data.buffer, data.headers);
            }
            first = false;
        });
    };

    function finalize() {
        if (cached === current) return;
        client.set(key, current, expires, function(err) {
            if (!err) return;
            err.key = key;
            client.emit('error', err);
        });
    };

    function readthrough(url, callback) {
        if (!options.client) return callback(new Error('No memcached client'));
        if (!options.expires) return callback(new Error('No expires option set'));

        var key = 'TL-' + url;
        var source = this;
        var client = options.client;
        var expires;
        if (typeof options.expires === 'number') {
            expires = options.expires;
        } else {
            expires = options.expires[urlParse(url).hostname] || options.expires.default || 300;
        }
        client.get(key, function(err, encoded) {
            // If error on memcached get, pass through to original source
            // without attempting a set after retrieval.
            if (err) {
                err.key = key;
                client.emit('error', err);
                return Source.prototype.get.call(source, url, callback);
            }

            // Cache hit.
            var data;
            if (encoded) try {
                data = decode(encoded);
            } catch(err) {
                err.key = key;
                client.emit('error', err);
            }
            if (data) return callback(data.err, data.buffer, data.headers);

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
    if (data.headers['content-length'] && data.headers['content-length'] != data.buffer.length)
        throw new Error('Content length does not match');
    return data;
};

