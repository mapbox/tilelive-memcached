var crypto = require('crypto');
var Memcached = require('memcached');

module.exports = Source;

var encode = function(err, buffer, headers) {
    if (err && err.message === 'Tile does not exist') return 'NOTILE';
    if (err && err.message === 'Grid does not exist') return 'NOGRID';

    // Unhandled error.
    if (err) throw new Error('Error could not be encoded: ' + err.message);

    // Encoded data.
    // Turn grids into buffers as well for unified caching.
    if (buffer && !(buffer instanceof Buffer)) buffer = new Buffer(JSON.stringify(buffer));

    return JSON.stringify(headers || {}) + buffer.toString('base64');
};

var decode = function(encoded) {
    if (encoded === 'NOTILE') {
        var err = new Error('Tile does not exist');
        err.memcached = true;
        return { err: err };
    }
    if (encoded === 'NOGRID') {
        var err = new Error('Grid does not exist');
        err.memcached = true;
        return { err: err };
    }

    var breaker = encoded.indexOf('}');
    if (breaker === -1) return new Error('Invalid cache value');

    var data = {};
    data.headers = JSON.parse(encoded.substr(0, breaker+1));
    data.headers['x-memcached'] = 'hit';
    data.buffer = new Buffer(encoded.substr(breaker), 'base64');

    // Return grids to object form.
    var ctype = data.headers['Content-Type'] || data.headers['content-type'];
    if (ctype && /json/.test(ctype)) data.buffer = JSON.parse(data.buffer);

    return data;
};

function Source(uri, callback) {
    if (!uri.backend) return callback && callback(new Error('No backend'));
    if (!uri.cachekey) return callback && callback(new Error('No cachekey'));

    this._uri = uri;
    this._expires = typeof uri.expires !== 'undefined' ? uri.expires : 300;
    this._client = uri.client || new Memcached('127.0.0.1:11211');
    this._backend = uri.backend;
    this._cachekey = uri.cachekey;

    // Proxy backend data key.
    this.data = this._backend.data || {};

    // @TODO massive hack to avoid conflict with tilelive-s3's
    // interpretation of 'maskLevel' key. Fix this by removing
    // masking entirely from the next version of tilelive-s3.
    if (this._backend.data && this._backend.data.maskLevel) {
        this.data._maskLevel = this._backend.data.maskLevel;
        delete this._backend.data.maskLevel;
    }

    callback && callback(null, this);
    return undefined;
};

Source.Memcached = Memcached;

Source.registerProtocols = function(tilelive) {
    tilelive.protocols['memcached:'] = Source;
};

Source.findID = function(filepath, id, callback) {
    return callback(new Error('id not found'));
};

Source.prototype.get = function(format, z, x, y, callback) {
    var key = 'TL-' + format + '-' + this._cachekey + '-' + z + '/' + x + '/' + y;
    var method = format === 'grid' ? 'getGrid' : 'getTile';
    var source = this;
    var backend = this._backend;

    this._client.get(key, function(getErr, encoded) {
        if (getErr) {
            getErr.key = key;
            getErr.method = method;
            source._client.emit('error', getErr);
        }

        // Cache hit.
        if (encoded) try {
            var data = decode(encoded);
            return callback(data.err, data.buffer, data.headers);
        } catch(err) {
            err.key = key;
            source._client.emit('error', err);
        }

        // Cache miss, error, or otherwise no data
        backend[method](z, x, y, function(err, buffer, headers) {
            if (err && !/(Tile|Grid) does not exist/.test(err.message)) return callback(err);
            // If error on memcached get, give it a break by not trying to set
            if (!getErr) {
                source._client.set(key, encode(err, buffer, headers), source._expires, function(cacheErr) {
                    if (cacheErr) {
                        cacheErr.key = key;
                        source._client.emit('error', cacheErr);
                    }
                    return callback(err, buffer, headers);
                });
            }
            else return callback(err, buffer, headers);
        });
    });
};

Source.prototype.getInfo = function(callback) {
    this._backend.getInfo.call(this._backend, callback);
};

Source.prototype.getTile = function(z, x, y, callback) {
    this.get('tile', z, x, y, callback);
};

Source.prototype.getGrid = function(z, x, y, callback) {
    this.get('grid', z, x, y, callback);
};

// Carmen search method.
Source.prototype.search = function(query, id, callback) {
    var key = 'TL-search-' + this._cachekey + (id
        ? '-id-' + encodeURI(id)
        : '-query-' + encodeURI(query));
    var source = this;
    var backend = this._backend;
    this._client.get(key, function(getErr, encoded) {
        if (getErr) {
            getErr.key = key;
            source._client.emit('error', getErr);
        }

        // Cache hit.
        if (encoded) try {
            return callback(null, JSON.parse(encoded));
        } catch(err) {
            err.key = key;
            source._client.emit('error', err);
        }

        backend.search(query, id, function(err, docs) {
            if (err) return callback(err);
            // If error on memcached get, give it a break by not trying to set
            if (!getErr) {
                source._client.set(key, JSON.stringify(docs), source._expires, function(cacheErr) {
                    if (cacheErr) {
                        cacheErr.key = key;
                        source._client.emit('error', cacheErr);
                    }
                    return callback(err, docs);
                });
            } else return callback(err, docs);
        });
    });
};

// Carmen feature method.
Source.prototype.feature = function(id, callback, raw) {
    var key = 'TL-feature-' + this._cachekey + (raw ? '-raw-' : '-') + id;
    var source = this;
    var backend = this._backend;
    this._client.get(key, function(getErr, encoded) {
        if (getErr) {
            getErr.key = key;
            source._client.emit('error', getErr);
        }

        // Cache hit.
        if (encoded) try {
            return callback(null, JSON.parse(encoded));
        } catch(err) {
            err.key = key;
            source._client.emit('error', err);
        }

        // Cache miss.
        backend.feature(id, function(err, data) {
            if (err) return callback(err);
            // If error on memcached get, give it a break by not trying to set
            if (!getErr) {
                source._client.set(key, JSON.stringify(data), source._expires, function(cacheErr) {
                    if (cacheErr) {
                        cacheErr.key = key;
                        source._client.emit('error', cacheErr);
                    }
                    return callback(err, data);
                });
            } else return callback(err, data);
        }, raw);
    });
};
