var urlParse = require('url').parse;
var util = require('util');
var memjs = require('memjs');

module.exports = function(options, Source) {
    if (!Source) throw new Error('No source provided');
    if (!Source.prototype.get) throw new Error('No get method found on source');

    function Caching() { return Source.apply(this, arguments); }

    // Inheritance.
    util.inherits(Caching, Source);

    // References for testing, convenience, post-call overriding.
    Caching.memcached = options;

    Caching.prototype.get = module.exports.cachingGet('TL', options, Source.prototype.get);

    return Caching;
};

module.exports.cachingGet = function(namespace, options, get) {
    if (!get) throw new Error('No get function provided');
    if (!namespace) throw new Error('No namespace provided');

    options = options || {};
    options.client = ('client' in options) ? options.client : memjs.Client.create(null, {'keepAlive': true});
    options.expires = ('expires' in options) ? options.expires : 300;
    options.mode = ('mode' in options) ? options.mode : 'readthrough';
    options.logger = ('logger' in options) ? options.logger: console;

    if (!options.client) throw new Error('No memcached client');
    if (!options.expires) throw new Error('No expires option set');

    var caching;
    if (options.mode === 'readthrough') {
        caching = readthrough;
    } else if (options.mode === 'race') {
        caching = race;
    } else if (options.mode === 'relay') {
        caching = relay;
    } else {
        throw new Error('Invalid value for options.mode ' + options.mode);
    }

    function race(url, callback) {
        var key = namespace + '-' + url;
        var source = this;
        var client = options.client;
        var expires;
        if (typeof options.expires === 'number') {
            expires = options.expires;
        } else {
            expires = options.expires[urlParse(url).hostname] || options.expires.default || 300;
        }

        var sent = false;
        var cached = null;
        var current = null;

        // GET upstream.
        get.call(source, url, function(err, buffer, headers) {
            current = encode(err, buffer, headers);
            if (cached && current) finalize();
            if (sent) return;
            sent = true;
            callback(err, buffer, headers);
        });

        // GET memcached.
        client.get(key, function(err, encoded) {
            // If error on memcached, do not flip first flag.
            // Finalize will never occur (no cache set).
            if (err) {
                err.key = key;
                return options.logger.log(err);
            }

            cached = encoded || '500';
            if (cached && current) finalize();
            if (sent || !encoded) return;
            var data;
            try {
                data = decode(cached);
            } catch(e) {
                e.key = key;
                options.logger.log(e);
                cached = '500';
            }
            if (data) {
                sent = true;
                callback(data.err, data.buffer, data.headers);
            }
        });

        function finalize() {
            if (cached === current) return;
            client.set(key, current, function(err) {
                if (err) {
                    err.key = key;
                    options.logger.log(err);
                }
            }, expires);
        }
    }

    function readthrough(url, callback) {
        var key = namespace + '-' + url;
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
                options.logger.log(err);
                return get(url, callback);
            }

            // Cache hit.
            var data;
            if (encoded) try {
                data = decode(encoded);
            } catch(e) {
                e.key = key;
                options.logger.log(e);
            }
            if (data) return callback(data.err, data.buffer, data.headers);

            // Cache miss, error, or otherwise no data
            get.call(source, url, function(err, buffer, headers) {
                if (err && !errcode(err)) return callback(err);
                callback(err, buffer, headers);

                // Callback does not need to wait for memcached set to occur.
                client.set(key, encode(err, buffer, headers), function(err) {
                    if (!err) return;
                    err.key = key;
                    options.logger.log(err);
                }, expires);
            });

        });
    }

    function relay(url, callback) {
        var key = namespace + '-' + url;
        var source = this;
        var client = options.client;
        var expires;
        if (typeof options.expires === 'number') {
            expires = options.expires;
        } else {
            expires = options.expires[urlParse(url).hostname] || options.expires.default || 600;
        }
        var ttl;
        if (options.ttl === undefined) {
            ttl = 300;
        } else if (typeof options.ttl === 'number') {
            ttl = options.ttl;
        } else {
            ttl = options.ttl[urlParse(url).hostname] || options.ttl.default || 300;
        }

        client.get(key, function(err, encoded) {
            // If error on memcached get, pass through to original source
            // without attempting a set after retrieval.
            if (err) {
                err.key = key;
                options.logger.log(err);
                return get.call(source,url, callback);
            }

            // Cache hit.
            var data;
            if (encoded) try {
                data = decode(encoded);
            } catch(e) {
                e.key = key;
                options.logger.log(e);
            }
            if (data) {
                callback(data.err, data.buffer, data.headers);
                if (isFresh(data)) return;

                // Update cache & bump `expires` header
                get.call(source, url, function(err, buffer, headers) {
                    if (err && !errcode(err)) {
                        return options.logger.log(err);
                    }
                    headers = headers || {};
                    headers.expires = (new Date(Date.now() + (ttl * 1000))).toUTCString();
                    client.set(key, encode(err, buffer, headers), function(err) {
                        if (err) {
                            err.key = key;
                            options.logger.log(err);
                        }
                    }, expires);
                });
            } else {
                // Cache miss, error, or otherwise no data
                get.call(source, url, function(err, buffer, headers) {
                    if (err && !errcode(err)) return callback(err);

                    headers = headers || {};
                    headers.expires = (new Date(Date.now() + (ttl * 1000))).toUTCString();
                    callback(err, buffer, headers);
                    client.set(key, encode(err, buffer, headers), function(err) {
                        if (err) {
                            err.key = key;
                            options.logger.log(err);
                        }
                    }, expires);
                });
            }
        });

        function isFresh(d) {
            // When we don't have an expires header just assume staleness
            if (d.headers === undefined || !d.headers.expires) return false;

            return (+(new Date(d.headers.expires)) > Date.now());
        }
    }
    return caching;
};

module.exports.memjs = memjs;
module.exports.encode = encode;
module.exports.decode = decode;

function errcode(err) {
    if (!err) return;
    if (err.statusCode === 404) return 404;
    if (err.statusCode === 403) return 403;
    return;
}

function encode(err, buffer, headers) {
    if (errcode(err)) return errcode(err).toString();

    // Unhandled error.
    if (err) return null;

    headers = headers || {};

    // Turn objects into JSON string buffers.
    if (buffer && typeof buffer === 'object' && !(buffer instanceof Buffer)) {
        headers['x-memcached-json'] = true;
        buffer = new Buffer(JSON.stringify(buffer));
    // Turn strings into buffers.
    } else if (buffer && !(buffer instanceof Buffer)) {
        buffer = new Buffer(buffer);
    }

    headers = new Buffer(JSON.stringify(headers), 'utf8');

    if (headers.length > 1024) {
        throw new Error('Invalid cache value - headers exceed 1024 bytes: ' + JSON.stringify(headers));
    }

    var padding = new Buffer(1024 - headers.length);
    padding.fill(' ');
    var len = headers.length + padding.length + buffer.length;
    return Buffer.concat([headers, padding, buffer], len);
}

function decode(encoded) {
    if (encoded.length == 3) {
        encoded = encoded.toString();
        if (encoded === '404' || encoded === '403') {
            var err = new Error(encoded === '404' ? 'Not found' : 'forbidden');
            err.statusCode = parseInt(encoded, 10);
            err.memcached = true;
            return { err: err };
        }
    }

    // First 1024 bytes reserved for header + padding.
    var offset = 1024;
    var data = {};
    data.headers = encoded.slice(0, offset).toString().trim();

    try {
        data.headers = JSON.parse(data.headers);
    } catch(e) {
        throw new Error('Invalid cache value');
    }

    data.headers['x-memcached'] = 'hit';
    data.buffer = encoded.slice(offset);

    // Return JSON-encoded objects to true form.
    if (data.headers['x-memcached-json']) data.buffer = JSON.parse(data.buffer);

    if (data.headers['content-length'] && data.headers['content-length'] != data.buffer.length)
        throw new Error('Content length does not match');
    return data;
}
