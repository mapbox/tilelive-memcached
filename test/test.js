var assert = require('assert');
var Memsource = require('../index');
var Memcached = Memsource.Memcached;
var deadclient = new Memcached('127.0.0.1:11212');

var Testsource = require('./testsource');
var tiles = Testsource.tiles;
var grids = Testsource.grids;
var now = Testsource.now;

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
    it('sets mode from opts', function(done) {
        assert.throws(function() {
            var Source = Memsource({ mode:'awesome' }, Testsource);
        }, /Invalid value for options\.mode/);
        var Source = Memsource({ mode:'race' }, Testsource);
        assert.ok(Source.memcached.mode, 'readthrough');
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

describe('readthrough', function() {
    var source;
    var longsource;
    var deadsource;
    var Source = Memsource({ expires: {
        long: 60000,
        test: 1
    } }, Testsource);
    before(function(done) {
        Source.memcached.client.flush(done);
    });
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
        var Dead = Memsource({ expires: {
            long: 60000,
            test: 1
        }, mode:'race', client:deadclient }, Testsource);
        new Dead({ delay:50 }, function(err, memsource) {
            if (err) throw err;
            deadsource = memsource;
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
    it('long tile 200 a miss', function(done) {
        longsource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('long tile 200 b miss', function(done) {
        longsource.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('long grid 200 a miss', function(done) {
        longsource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('long grid 200 b miss', function(done) {
        longsource.getGrid(1, 0, 0, grid(grids.b, false, done));
    });
    it('dead tile 200 a miss', function(done) {
        deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('dead tile 200 b miss', function(done) {
        deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('dead grid 200 a miss', function(done) {
        deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('dead grid 200 b miss', function(done) {
        deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
    });
    describe('expires', function() {
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
        it('dead tile 200 a miss', function(done) {
            deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
        });
        it('dead tile 200 b miss', function(done) {
            deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
        });
        it('dead grid 200 a miss', function(done) {
            deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
        });
        it('dead grid 200 b miss', function(done) {
            deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
        });
    });
});

describe('race', function() {
    var source;
    var longsource;
    var fastsource;
    var deadsource;
    var Source = Memsource({ expires: {
        long: 60000,
        test: 1
    }, mode:'race' }, Testsource);
    before(function(done) {
        Source.memcached.client.flush(done);
    });
    before(function(done) {
        new Source({ delay:50 }, function(err, memsource) {
            if (err) throw err;
            source = memsource;
            done();
        });
    });
    before(function(done) {
        new Source({ hostname:'long', delay:50 }, function(err, memsource) {
            if (err) throw err;
            longsource = memsource;
            done();
        });
    });
    before(function(done) {
        new Source({ delay:0 }, function(err, memsource) {
            if (err) throw err;
            fastsource = memsource;
            done();
        });
    });
    before(function(done) {
        var Dead = Memsource({ expires: {
            long: 60000,
            test: 1
        }, mode:'race', client:deadclient }, Testsource);
        new Dead({ delay:50 }, function(err, memsource) {
            if (err) throw err;
            deadsource = memsource;
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
    it('fast tile 200 a miss', function(done) {
        fastsource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('fast tile 200 a miss', function(done) {
        fastsource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('fast grid 200 a miss', function(done) {
        fastsource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('fast grid 200 a miss', function(done) {
        fastsource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('long tile 200 a miss', function(done) {
        longsource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('long tile 200 b miss', function(done) {
        longsource.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('long grid 200 a miss', function(done) {
        longsource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('long grid 200 b miss', function(done) {
        longsource.getGrid(1, 0, 0, grid(grids.b, false, done));
    });
    it('dead tile 200 a miss', function(done) {
        deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('dead tile 200 b miss', function(done) {
        deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('dead grid 200 a miss', function(done) {
        deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('dead grid 200 b miss', function(done) {
        deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
    });
    describe('expires', function() {
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
        it('dead tile 200 a miss', function(done) {
            deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
        });
        it('dead tile 200 b miss', function(done) {
            deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
        });
        it('dead grid 200 a miss', function(done) {
            deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
        });
        it('dead grid 200 b miss', function(done) {
            deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
        });
    });
});

