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
            'last-modified': now.toUTCString()
        });
    case 'http://test/1/0/0.png':
        return callback(null, tiles.b, {
            'content-type': 'image/png',
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
    default:
        var err = new Error;
        err.status = 404;
        return callback(err);
    }
};
Testsource.prototype.getTile = function(z, x, y, callback) {
    this.get('http://test/' + [z,x,y].join('/') + '.png', function(err, buffer, headers) {
        if (err) {
            err.message = 'Tile does not exist';
            return callback(err);
        }
        return callback(null, buffer, headers);
    });
};
Testsource.prototype.getGrid = function(z, x, y, callback) {
    this.get('http://test/' + [z,x,y].join('/') + '.grid.json', function(err, buffer, headers) {
        if (err) {
            err.message = 'Grid does not exist';
            return callback(err);
        }
        return callback(null, JSON.parse(buffer), headers);
    });
};
Testsource.prototype.search = function(query, id, callback) {
    this.stat.search++;
    if (query === 'seattle') return callback(null, search['seattle']);
    if (id === '219339') return callback(null, search['219339']);
    return callback(null, []);
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

function carmenSearch(source, args, cached, done) {
    var statcount = source.stat.search;
    source.search(args.query, args.id, function(err, data) {
        assert.ifError(err);
        assert.equal(cached ? statcount : statcount + 1, source.stat.search);
        if (search[args.id||args.query]) {
            assert.deepEqual(search[args.id||args.query], data);
        } else {
            assert.deepEqual([], data);
        }
        done();
    });
};

function carmenFeature(source, id, raw, cached, done) {
    var statcount = source.stat.feature;
    source.feature(id, function(err, data) {
        var key = raw ? id + '.raw' : id;
        if (feature[key]) {
            assert.ifError(err);
            assert.deepEqual(feature[key], data);
            assert.equal(cached ? statcount : statcount + 1, source.stat.feature);
        } else {
            assert.deepEqual(undefined, data);
            assert.equal(statcount + 1, source.stat.feature);
        }
        done();
    }, raw);
};

describe('api', function() {
    var source;
    before(function(done) {
        var Source = Memsource({ expires:1 }, Testsource);
        new Source('', function(err, memsource) {
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

describe('carmen', function(done) {
    var source;
    before(function(done) {
        var Source = Memsource({ expires:1 }, Testsource);
        new Source('', function(err, memsource) {
            if (err) throw err;
            source = memsource;
            done();
        });
    });
    it('search asdf miss', function(done) {
        carmenSearch(source, {query:'asdf'}, false, done);
    });
    it('search asdf hit', function(done) {
        carmenSearch(source, {query:'asdf'}, true, done);
    });
    it('search seattle miss', function(done) {
        carmenSearch(source, {query:'seattle'}, false, done);
    });
    it('search seattle hit', function(done) {
        carmenSearch(source, {query:'seattle'}, true, done);
    });
    it('search 219339 miss', function(done) {
        carmenSearch(source, {id:'219339'}, false, done);
    });
    it('search 219339 hit', function(done) {
        carmenSearch(source, {id:'219339'}, true, done);
    });
    it('feature 9999 miss', function(done) {
        carmenFeature(source, '9999', false, false, done);
    });
    it('feature 9999 hit', function(done) {
        carmenFeature(source, '9999', false, true, done);
    });
    it('feature 9999 raw miss', function(done) {
        carmenFeature(source, '9999', true, false, done);
    });
    it('feature 9999 raw hit', function(done) {
        carmenFeature(source, '9999', true, true, done);
    });
    it('feature 219339 miss', function(done) {
        carmenFeature(source, '219339', false, false, done);
    });
    it('feature 219339 hit', function(done) {
        carmenFeature(source, '219339', false, true, done);
    });
    it('feature 219339 raw miss', function(done) {
        carmenFeature(source, '219339', true, false, done);
    });
    it('feature 219339 raw hit', function(done) {
        carmenFeature(source, '219339', true, true, done);
    });
});

describe('expires', function() {
    var source;
    before(function(done) {
        var Source = Memsource({ expires:1 }, Testsource);
        new Source('', function(err, memsource) {
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
