var assert = require('assert');
var Memsource = require('../index');
var Memcached = Memsource.Memcached;

var now = new Date;
var tiles = {
    a: require('fs').readFileSync(__dirname + '/a.png'),
    b: require('fs').readFileSync(__dirname + '/b.png'),
};
var grids = {
    a: { grid:'', keys: ['', '1' ], data:{'1': {'name':'foo'}} },
    b: { grid:'', keys: ['', '1' ], data:{'1': {'name':'bar'}} },
};
var search = {
    'seattle': [
        {
            text: 'seattle-,seattle bar',
            id: '138155',
            zxy: [ '11/323/1287' ]
        },
        {
            text: 'seattle',
            id: '219339',
            zxy: [
                '11/327/1331',
                '11/327/1332',
                '11/327/1333',
                '11/328/1331',
                '11/328/1332',
                '11/328/1333'
            ]
        }
    ],
    '219339': [
        {
            text: 'seattle',
            id: '219339',
            zxy: [
                '11/327/1331',
                '11/327/1332',
                '11/327/1333',
                '11/328/1331',
                '11/328/1332',
                '11/328/1333'
            ]
        }
    ]
};
var feature = {
    '219339.raw': {
        _terms: [ '/mapbox-places/term/seattle.219339.11,327,1331.11,327,1332.11,327,1333.11,328,1331.11,328,1332.11,328,1333' ],
        bounds: '-122.459696,47.4817199999999,-122.224433,47.734145',
        lat: 47.6204993,
        lon: -122.3508761,
        name: 'Seattle',
        score: 900000369465466.8,
        search: 'Seattle',
        type: 'city'
    },
    '219339': {
        bounds: '-122.459696,47.4817199999999,-122.224433,47.734145',
        lat: 47.6204993,
        lon: -122.3508761,
        name: 'Seattle',
        score: 900000369465466.8,
        search: 'Seattle',
        type: 'city'
    }
};

// Define a mock test source.
function Testsource(uri, callback) {
    this._uri = uri;
    this.hostname = uri.hostname || 'test';
    this.data = { _carmen: 'http://www.example.com' };
    this.stat = {
        'get': 0,
        'search': 0,
        'feature': 0
    };
    callback(null, this);
};
Testsource.prototype.get = function(url, callback) {
    this.stat.get++;
    switch (url) {
    case 'http://test/0/0/0.png':
        return callback(null, tiles.a, {
            'content-type': 'image/png',
            'content-length': 11541,
            'last-modified': now.toUTCString()
        });
    case 'http://test/1/0/0.png':
        return callback(null, tiles.b, {
            'content-type': 'image/png',
            'content-length': 6199,
            'last-modified': now.toUTCString()
        });
    case 'http://test/0/0/0.grid.json':
        return callback(null, JSON.stringify(grids.a), {
            'content-type': 'application/json',
            'last-modified': now.toUTCString()
        });
    case 'http://test/1/0/0.grid.json':
        return callback(null, JSON.stringify(grids.b), {
            'content-type': 'application/json',
            'last-modified': now.toUTCString()
        });
    case 'http://long/0/0/0.png':
        return callback(null, tiles.a, {
            'content-type': 'image/png',
            'content-length': 11541,
            'last-modified': now.toUTCString()
        });
    case 'http://long/1/0/0.png':
        return callback(null, tiles.b, {
            'content-type': 'image/png',
            'content-length': 6199,
            'last-modified': now.toUTCString()
        });
    case 'http://long/0/0/0.grid.json':
        return callback(null, JSON.stringify(grids.a), {
            'content-type': 'application/json',
            'last-modified': now.toUTCString()
        });
    case 'http://long/1/0/0.grid.json':
        return callback(null, JSON.stringify(grids.b), {
            'content-type': 'application/json',
            'last-modified': now.toUTCString()
        });
    default:
        var err = new Error;
        err.status = 404;
        return callback(err);
    }
};
Testsource.prototype.getTile = function(z, x, y, callback) {
    this.get('http://' + this.hostname + '/' + [z,x,y].join('/') + '.png', function(err, buffer, headers) {
        if (err) {
            err.message = 'Tile does not exist';
            return callback(err);
        }
        return callback(null, buffer, headers);
    });
};
Testsource.prototype.getGrid = function(z, x, y, callback) {
    this.get('http://' + this.hostname + '/' + [z,x,y].join('/') + '.grid.json', function(err, buffer, headers) {
        if (err) {
            err.message = 'Grid does not exist';
            return callback(err);
        }
        return callback(null, JSON.parse(buffer), headers);
    });
};
Testsource.prototype.search = function(query, id, callback) {
    this.stat.search++;
    if (query === 'seattle') return callback(null, search['seattle'].slice(0));
    if (id === '219339') return callback(null, search['219339'].slice(0));
    return callback(null, [].slice(0));
};
Testsource.prototype.feature = function(id, callback, raw) {
    this.stat.feature++;
    if (id !== '219339') return callback(new Error('Not found'));
    if (raw) return callback(null, feature['219339.raw']);
    if (!raw) return callback(null, feature['219339']);
    return callback(new Error('Not found'));
};

describe('load', function() {
    it('fails without source', function(done) {
        assert.throws(function() { Memsource({}) });
        assert.throws(function() { Memsource({}, {}) });
        done();
    });
    it('loads + sets default values', function(done) {
        var Source = Memsource({}, Testsource);
        assert.ok(Source.memcached);
        assert.ok(Source.memcached.client);
        assert.ok(Source.memcached.expires, 300);
        new Source('fakeuri', function(err, source) {
            assert.ifError(err);
            assert.ok(source instanceof Testsource);
            assert.equal(source._uri, 'fakeuri');
            done();
        });
    });
    it('sets expires from opts', function(done) {
        var Source = Memsource({ expires:5 }, Testsource);
        assert.ok(Source.memcached);
        assert.ok(Source.memcached.expires, 5);
        done();
    });
    it('sets client from opts', function(done) {
        var client = new Memcached('127.0.0.1:11211');
        var Source = Memsource({ client: client, expires:5 }, Testsource);
        assert.ok(Source.memcached);
        assert.strictEqual(Source.memcached.client, client);
        done();
    });
});

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
        assert.deepEqual(data, expected);
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
    var longsource;
    var Source = Memsource({ expires:{
        long: 60000,
        test: 1
    } }, Testsource);
    before(function(done) {
        new Source('', function(err, memsource) {
            if (err) throw err;
            source = memsource;
            done();
        });
    });
    before(function(done) {
        new Source({hostname:'long'}, function(err, memsource) {
            if (err) throw err;
            longsource = memsource;
            done();
        });
    });
    before(function(done) {
        Source.memcached.client.flush(done);
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
    it('long tile 200 a hit', function(done) {
        longsource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('long tile 200 b hit', function(done) {
        longsource.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('long grid 200 a hit', function(done) {
        longsource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('long grid 200 b hit', function(done) {
        longsource.getGrid(1, 0, 0, grid(grids.b, false, done));
    });
});

describe('expires', function() {
    var source;
    var longsource;
    var Source = Memsource({ expires:{
        long: 60000,
        test: 1
    } }, Testsource);
    before(function(done) {
        new Source('', function(err, memsource) {
            if (err) throw err;
            source = memsource;
            done();
        });
    });
    before(function(done) {
        new Source({hostname:'long'}, function(err, memsource) {
            if (err) throw err;
            longsource = memsource;
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
    it('long tile 200 a hit', function(done) {
        longsource.getTile(0, 0, 0, tile(tiles.a, true, done));
    });
    it('long tile 200 b hit', function(done) {
        longsource.getTile(1, 0, 0, tile(tiles.b, true, done));
    });
    it('long grid 200 a hit', function(done) {
        longsource.getGrid(0, 0, 0, grid(grids.a, true, done));
    });
    it('long grid 200 b hit', function(done) {
        longsource.getGrid(1, 0, 0, grid(grids.b, true, done));
    });
});
