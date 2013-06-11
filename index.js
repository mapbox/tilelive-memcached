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

    this._client.get(key, function(err, encoded) {
        if (err) return callback(err);

        // Cache hit.
        if (encoded) try {
            var data = decode(encoded);
            return callback(data.err, data.buffer, data.headers);
        } catch(err) {
            console.warn(encoded);
            return callback(err);
        }

        // Cache miss.
        backend[method](z, x, y, function(err, buffer, headers) {
            if (err && !/(Tile|Grid) does not exist/.test(err.message)) return callback(err);

            source._client.set(key, encode(err, buffer, headers), source._expires, function(cacheErr) {
                if (cacheErr) return callback(cacheErr);
                return callback(err, buffer, headers);
            });
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
