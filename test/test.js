var assert = require('assert');
var Memcached = require('../node_modules/memcached');
var Memsource = require('../index');

var now = new Date;
var tiles = {
    a: require('fs').readFileSync(__dirname + '/a.png'),
    b: require('fs').readFileSync(__dirname + '/b.png'),
};
var grids = {
    a: { grid:'', keys: ['', '1' ], data:{'1': {'name':'foo'}} },
    b: { grid:'', keys: ['', '1' ], data:{'1': {'name':'bar'}} },
};

function Testsource(uri, callback) {
    this._uri = uri;
};
Testsource.prototype.getTile = function(z, x, y, callback) {
    var key = [z,x,y].join('/');
    switch (key) {
    case '0/0/0':
        return callback(null, tiles.a, {
            'content-type': 'image/png',
            'last-modified': now.toUTCString()
        });
    case '1/0/0':
        return callback(null, tiles.b, {
            'content-type': 'image/png',
            'last-modified': now.toUTCString()
        });
    default:
        return callback(new Error('Tile does not exist'));
    }
};
Testsource.prototype.getGrid = function(z, x, y, callback) {
    var key = [z,x,y].join('/');
    switch (key) {
    case '0/0/0':
        return callback(null, grids.a, {
            'content-type': 'application/json',
            'last-modified': now.toUTCString()
        });
    case '1/0/0':
        return callback(null, grids.b, {
            'content-type': 'application/json',
            'last-modified': now.toUTCString()
        });
    default:
        return callback(new Error('Grid does not exist'));
    }
};

describe('load', function() {
    it('fails without backend', function(done) {
        new Memsource({}, function(err) {
            assert.equal(err.message, 'No backend');
            done();
        });
    });
    it('loads + sets default values', function(done) {
        var source = new Memsource({ backend: new Testsource });
        assert.ok(source);
        assert.ok(source._uri);
        assert.ok(source._backend);
        assert.ok(source._cachekey);
        assert.ok(source._client);
        assert.equal(source._expires, 300);
        done();
    });
    it('loads async', function(done) {
        new Memsource({ backend: new Testsource }, function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            assert.ok(source._client);
            done();
        });
    });
    it('sets expires from uri', function(done) {
        new Memsource({ backend: new Testsource, expires: 5 }, function(err, source) {
            assert.ifError(err);
            assert.equal(source._expires, 5);
            done();
        });
    });
    it('sets client from uri', function(done) {
        var client = new Memcached('127.0.0.1:11211');
        new Memsource({ backend: new Testsource, client: client}, function(err, source) {
            assert.ifError(err);
            assert.strictEqual(source._client, client);
            done();
        });
    });
});

// @TODO backend key testing.

var tile = function(expected, cached, done) {
    return function(err, data, headers) {
        assert.ifError(err);
        assert.ok(data instanceof Buffer);
        assert.ok(cached ? headers['x-memcached'] : !headers['x-memcached']);
        assert[cached ? 'deepEqual' : 'strictEqual'](data, expected);
        assert.equal(data.length, expected.length);
        assert.equal(headers['content-type'], 'image/png');
        assert.equal(headers['last-modified'], now.toUTCString());
        done();
    };
};
var grid = function(expected, cached, done) {
    return function(err, data, headers) {
        assert.ifError(err);
        assert.ok(cached ? headers['x-memcached'] : !headers['x-memcached']);
        assert[cached ? 'deepEqual' : 'strictEqual'](data, expected);
        assert.equal(headers['content-type'], 'application/json');
        assert.equal(headers['last-modified'], now.toUTCString());
        done();
    };
};
var error = function(message, cached, done) {
    return function(err, data, headers) {
        assert.ok(cached ? err.memcached : !err.memcached);
        assert.equal(err.message, message);
        done();
    };
};

describe('api', function() {
    var source;
    before(function(done) {
        new Memsource({
            backend: new Testsource,
            expires: 1
        }, function(err, memsource) {
            if (err) throw err;
            source = memsource;
            done();
        });
    });
    it('tile 200 a miss', function(done) {
        source.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('tile 200 a hit', function(done) {
        source.getTile(0, 0, 0, tile(tiles.a, true, done));
    });
    it('tile 200 b miss', function(done) {
        source.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('tile 200 b hit', function(done) {
        source.getTile(1, 0, 0, tile(tiles.b, true, done));
    });
    it('tile 40x miss', function(done) {
        source.getTile(4, 0, 0, error('Tile does not exist', false, done));
    });
    it('tile 40x hit', function(done) {
        source.getTile(4, 0, 0, error('Tile does not exist', true, done));
    });
    it('grid 200 a miss', function(done) {
        source.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('grid 200 a hit', function(done) {
        source.getGrid(0, 0, 0, grid(grids.a, true, done));
    });
    it('grid 200 b miss', function(done) {
        source.getGrid(1, 0, 0, grid(grids.b, false, done));
    });
    it('grid 200 b hit', function(done) {
        source.getGrid(1, 0, 0, grid(grids.b, true, done));
    });
    it('grid 40x miss', function(done) {
        source.getGrid(4, 0, 0, error('Grid does not exist', false, done));
    });
    it('grid 40x hit', function(done) {
        source.getGrid(4, 0, 0, error('Grid does not exist', true, done));
    });
});

describe('expires', function() {
    var source;
    before(function(done) {
        new Memsource({
            backend: new Testsource,
            expires: 1
        }, function(err, memsource) {
            if (err) throw err;
            source = memsource;
            done();
        });
    });
    before(function(done) {
        setTimeout(done, 1000);
    });
    it('tile 200 a expires', function(done) {
        source.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('tile 200 b expires', function(done) {
        source.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('tile 40x expires', function(done) {
        source.getTile(4, 0, 0, error('Tile does not exist', false, done));
    });
    it('grid 200 a expires', function(done) {
        source.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('grid 200 b expires', function(done) {
        source.getGrid(1, 0, 0, grid(grids.b, false, done));
    });
    it('grid 40x expires', function(done) {
        source.getGrid(4, 0, 0, error('Grid does not exist', false, done));
    });
});
