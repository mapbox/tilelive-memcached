var assert = require('assert');
var bufferEqual = require('buffer-equal');
var Memsource = require('../index');
var memjs = Memsource.memjs;
var deadclient = memjs.Client.create('127.0.0.1:11212');

var Testsource = require('./testsource');
var tiles = Testsource.tiles;
var grids = Testsource.grids;
var now = Testsource.now;

describe('load', function() {
    it('fails without source', function(done) {
        assert.throws(function() { Memsource({}); });
        assert.throws(function() { Memsource({}, {}); });
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
        var client = memjs.Client.create('127.0.0.1:11211');
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
//
//describe('readthrough', function() {
//    var source;
//    var longsource;
//    var deadsource;
//    var Source = Memsource({ expires: {
//        long: 60000,
//        test: 1
//    } }, Testsource);
//    before(function(done) {
//        Source.memcached.client.flush(done);
//    });
//    before(function(done) {
//        new Source('', function(err, memsource) {
//            if (err) throw err;
//            source = memsource;
//            done();
//        });
//    });
//    before(function(done) {
//        new Source({hostname:'long'}, function(err, memsource) {
//            if (err) throw err;
//            longsource = memsource;
//            done();
//        });
//    });
//    before(function(done) {
//        var Dead = Memsource({ expires: {
//            long: 60000,
//            test: 1
//        }, mode:'race', client:deadclient }, Testsource);
//        new Dead({ delay:50 }, function(err, memsource) {
//            if (err) throw err;
//            deadsource = memsource;
//            done();
//        });
//    });
//    it('tile 200 a miss', function(done) {
//        source.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('tile 200 a hit', function(done) {
//        source.getTile(0, 0, 0, tile(tiles.a, true, done));
//    });
//    it('tile 200 b miss', function(done) {
//        source.getTile(1, 0, 0, tile(tiles.b, false, done));
//    });
//    it('tile 200 b hit', function(done) {
//        source.getTile(1, 0, 0, tile(tiles.b, true, done));
//    });
//    it('tile 40x miss', function(done) {
//        source.getTile(4, 0, 0, error('Not found', false, done));
//    });
//    it('tile 40x hit', function(done) {
//        source.getTile(4, 0, 0, error('Not found', true, done));
//    });
//    it('tile 500 miss', function(done) {
//        source.getTile(2, 0, 0, error('Unexpected error', false, done));
//    });
//    it('tile 500 miss', function(done) {
//        source.getTile(2, 0, 0, error('Unexpected error', false, done));
//    });
//    it('grid 200 a miss', function(done) {
//        source.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('grid 200 a hit', function(done) {
//        source.getGrid(0, 0, 0, grid(grids.a, true, done));
//    });
//    it('grid 200 b miss', function(done) {
//        source.getGrid(1, 0, 0, grid(grids.b, false, done));
//    });
//    it('grid 200 b hit', function(done) {
//        source.getGrid(1, 0, 0, grid(grids.b, true, done));
//    });
//    it('grid 40x miss', function(done) {
//        source.getGrid(4, 0, 0, error('Not found', false, done));
//    });
//    it('grid 40x hit', function(done) {
//        source.getGrid(4, 0, 0, error('Not found', true, done));
//    });
//    it('long tile 200 a miss', function(done) {
//        longsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('long tile 200 b miss', function(done) {
//        longsource.getTile(1, 0, 0, tile(tiles.b, false, done));
//    });
//    it('long grid 200 a miss', function(done) {
//        longsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('long grid 200 b miss', function(done) {
//        longsource.getGrid(1, 0, 0, grid(grids.b, false, done));
//    });
//    it('dead tile 200 a miss', function(done) {
//        deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('dead tile 200 b miss', function(done) {
//        deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
//    });
//    it('dead grid 200 a miss', function(done) {
//        deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('dead grid 200 b miss', function(done) {
//        deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
//    });
//    describe('expires', function() {
//        before(function(done) {
//            setTimeout(done, 1000);
//        });
//        it('tile 200 a expires', function(done) {
//            source.getTile(0, 0, 0, tile(tiles.a, false, done));
//        });
//        it('tile 200 b expires', function(done) {
//            source.getTile(1, 0, 0, tile(tiles.b, false, done));
//        });
//        it('tile 40x expires', function(done) {
//            source.getTile(4, 0, 0, error('Not found', false, done));
//        });
//        it('grid 200 a expires', function(done) {
//            source.getGrid(0, 0, 0, grid(grids.a, false, done));
//        });
//        it('grid 200 b expires', function(done) {
//            source.getGrid(1, 0, 0, grid(grids.b, false, done));
//        });
//        it('grid 40x expires', function(done) {
//            source.getGrid(4, 0, 0, error('Not found', false, done));
//        });
//        it('long tile 200 a hit', function(done) {
//            longsource.getTile(0, 0, 0, tile(tiles.a, true, done));
//        });
//        it('long tile 200 b hit', function(done) {
//            longsource.getTile(1, 0, 0, tile(tiles.b, true, done));
//        });
//        it('long grid 200 a hit', function(done) {
//            longsource.getGrid(0, 0, 0, grid(grids.a, true, done));
//        });
//        it('long grid 200 b hit', function(done) {
//            longsource.getGrid(1, 0, 0, grid(grids.b, true, done));
//        });
//        it('dead tile 200 a miss', function(done) {
//            deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//        });
//        it('dead tile 200 b miss', function(done) {
//            deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
//        });
//        it('dead grid 200 a miss', function(done) {
//            deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//        });
//        it('dead grid 200 b miss', function(done) {
//            deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
//        });
//    });
//});
//
//describe('race', function() {
//    var source;
//    var longsource;
//    var fastsource;
//    var deadsource;
//    var Source = Memsource({ expires: {
//        long: 60000,
//        test: 1
//    }, mode:'race' }, Testsource);
//    before(function(done) {
//        Source.memcached.client.flush(done);
//    });
//    before(function(done) {
//        new Source({ delay:50 }, function(err, memsource) {
//            if (err) throw err;
//            source = memsource;
//            done();
//        });
//    });
//    before(function(done) {
//        new Source({ hostname:'long', delay:50 }, function(err, memsource) {
//            if (err) throw err;
//            longsource = memsource;
//            done();
//        });
//    });
//    before(function(done) {
//        new Source({ delay:0 }, function(err, memsource) {
//            if (err) throw err;
//            fastsource = memsource;
//            done();
//        });
//    });
//    before(function(done) {
//        var Dead = Memsource({ expires: {
//            long: 60000,
//            test: 1
//        }, mode:'race', client:deadclient }, Testsource);
//        new Dead({ delay:50 }, function(err, memsource) {
//            if (err) throw err;
//            deadsource = memsource;
//            done();
//        });
//    });
//    it('tile 200 a miss', function(done) {
//        source.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('tile 200 a hit', function(done) {
//        source.getTile(0, 0, 0, tile(tiles.a, true, done));
//    });
//    it('tile 200 b miss', function(done) {
//        source.getTile(1, 0, 0, tile(tiles.b, false, done));
//    });
//    it('tile 200 b hit', function(done) {
//        source.getTile(1, 0, 0, tile(tiles.b, true, done));
//    });
//    it('tile 40x miss', function(done) {
//        source.getTile(4, 0, 0, error('Not found', false, done));
//    });
//    it('tile 40x hit', function(done) {
//        source.getTile(4, 0, 0, error('Not found', true, done));
//    });
//    it('tile 500 miss', function(done) {
//        source.getTile(2, 0, 0, error('Unexpected error', false, done));
//    });
//    it('tile 500 miss', function(done) {
//        source.getTile(2, 0, 0, error('Unexpected error', false, done));
//    });
//    it('grid 200 a miss', function(done) {
//        source.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('grid 200 a hit', function(done) {
//        source.getGrid(0, 0, 0, grid(grids.a, true, done));
//    });
//    it('grid 200 b miss', function(done) {
//        source.getGrid(1, 0, 0, grid(grids.b, false, done));
//    });
//    it('grid 200 b hit', function(done) {
//        source.getGrid(1, 0, 0, grid(grids.b, true, done));
//    });
//    it('grid 40x miss', function(done) {
//        source.getGrid(4, 0, 0, error('Not found', false, done));
//    });
//    it('grid 40x hit', function(done) {
//        source.getGrid(4, 0, 0, error('Not found', true, done));
//    });
//    it('fast tile 200 a miss', function(done) {
//        fastsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('fast tile 200 a miss', function(done) {
//        fastsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('fast grid 200 a miss', function(done) {
//        fastsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('fast grid 200 a miss', function(done) {
//        fastsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('long tile 200 a miss', function(done) {
//        longsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('long tile 200 b miss', function(done) {
//        longsource.getTile(1, 0, 0, tile(tiles.b, false, done));
//    });
//    it('long grid 200 a miss', function(done) {
//        longsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('long grid 200 b miss', function(done) {
//        longsource.getGrid(1, 0, 0, grid(grids.b, false, done));
//    });
//    it('dead tile 200 a miss', function(done) {
//        deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//    });
//    it('dead tile 200 b miss', function(done) {
//        deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
//    });
//    it('dead grid 200 a miss', function(done) {
//        deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//    });
//    it('dead grid 200 b miss', function(done) {
//        deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
//    });
//    describe('expires', function() {
//        before(function(done) {
//            setTimeout(done, 1000);
//        });
//        it('tile 200 a expires', function(done) {
//            source.getTile(0, 0, 0, tile(tiles.a, false, done));
//        });
//        it('tile 200 b expires', function(done) {
//            source.getTile(1, 0, 0, tile(tiles.b, false, done));
//        });
//        it('tile 40x expires', function(done) {
//            source.getTile(4, 0, 0, error('Not found', false, done));
//        });
//        it('grid 200 a expires', function(done) {
//            source.getGrid(0, 0, 0, grid(grids.a, false, done));
//        });
//        it('grid 200 b expires', function(done) {
//            source.getGrid(1, 0, 0, grid(grids.b, false, done));
//        });
//        it('grid 40x expires', function(done) {
//            source.getGrid(4, 0, 0, error('Not found', false, done));
//        });
//        it('long tile 200 a hit', function(done) {
//            longsource.getTile(0, 0, 0, tile(tiles.a, true, done));
//        });
//        it('long tile 200 b hit', function(done) {
//            longsource.getTile(1, 0, 0, tile(tiles.b, true, done));
//        });
//        it('long grid 200 a hit', function(done) {
//            longsource.getGrid(0, 0, 0, grid(grids.a, true, done));
//        });
//        it('long grid 200 b hit', function(done) {
//            longsource.getGrid(1, 0, 0, grid(grids.b, true, done));
//        });
//        it('dead tile 200 a miss', function(done) {
//            deadsource.getTile(0, 0, 0, tile(tiles.a, false, done));
//        });
//        it('dead tile 200 b miss', function(done) {
//            deadsource.getTile(1, 0, 0, tile(tiles.b, false, done));
//        });
//        it('dead grid 200 a miss', function(done) {
//            deadsource.getGrid(0, 0, 0, grid(grids.a, false, done));
//        });
//        it('dead grid 200 b miss', function(done) {
//            deadsource.getGrid(1, 0, 0, grid(grids.b, false, done));
//        });
//    });
//});
//
describe('relay', function() {
    var source;
    var longsource;
    var deadsource;
    var Source = Memsource({
        expires: {
            long: 60000,
            stale: 60000,
            test: 1
        },
        ttl: {
            long: 60000,
            stale: 1,
            test: 1
        },
        mode:'relay'
    }, Testsource);
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
        new Source({ hostname:'stale', delay:50 }, function(err, memsource) {
            if (err) throw err;
            stalesource = memsource;
            done();
        });
    });
    before(function(done) {
        var Dead = Memsource({ expires: {
            long: 60000,
            test: 1
        }, mode:'relay', client:deadclient }, Testsource);
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
        source.getTile(4, 0, 0, error('Not found', false, done));
    });
    it('tile 40x hit', function(done) {
        source.getTile(4, 0, 0, error('Not found', true, done));
    });
    it('tile 500 miss', function(done) {
        source.getTile(2, 0, 0, error('Unexpected error', false, done));
    });
    it('tile 500 miss', function(done) {
        source.getTile(2, 0, 0, error('Unexpected error', false, done));
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
        source.getGrid(4, 0, 0, error('Not found', false, done));
    });
    it('grid 40x hit', function(done) {
        source.getGrid(4, 0, 0, error('Not found', true, done));
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
    it('stale tile 200 a miss', function(done) {
        stalesource.getTile(0, 0, 0, tile(tiles.a, false, done));
    });
    it('stale tile 200 b miss', function(done) {
        stalesource.getTile(1, 0, 0, tile(tiles.b, false, done));
    });
    it('stale grid 200 a miss', function(done) {
        stalesource.getGrid(0, 0, 0, grid(grids.a, false, done));
    });
    it('stale grid 200 b miss', function(done) {
        stalesource.getGrid(1, 0, 0, grid(grids.b, false, done));
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
            source.getTile(4, 0, 0, error('Not found', false, done));
        });
        it('grid 200 a expires', function(done) {
            source.getGrid(0, 0, 0, grid(grids.a, false, done));
        });
        it('grid 200 b expires', function(done) {
            source.getGrid(1, 0, 0, grid(grids.b, false, done));
        });
        it('grid 40x expires', function(done) {
            source.getGrid(4, 0, 0, error('Not found', false, done));
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
    describe('refresh', function() {
        it('long tile 200 a hit', function(done) {
            longsource.getTile(0, 0, 0, function(err, data, headers) {
                var origExpires = headers.expires;
                setTimeout(function() {
                    longsource.getTile(0, 0, 0, function(err, data, headers) {
                        assert.equal(origExpires, headers.expires);
                        tile(tiles.a, true, done)(err, data, headers);
                    });
                }, 500);
            });
        });
        it('stale tile 200 a refresh hit', function(done) {
            stalesource.getTile(0, 0, 0, function(err, data, headers) {
                var origExpires = headers.expires;
                setTimeout(function() {
                    stalesource.getTile(0, 0, 0, function(err, data, headers) {
                        assert.notEqual(origExpires, headers.expires);
                        tile(tiles.a, true, done)(err, data, headers);
                    });
                }, 500);
            });
        });
    });
});

describe('cachingGet', function() {
    var stats = {};
    var options = { mode: 'readthrough' };
    var getter = function(id, callback) {
        stats[id] = stats[id] || 0;
        stats[id]++;

        if (id === 'missing') {
            var err = new Error('Not found');
            err.statusCode = 404;
            return callback(err);
        }
        if (id === 'fatal') {
            var err = new Error('Fatal');
            err.statusCode = 500;
            return callback(err);
        }
        if (id === 'nocode') {
            var err = new Error('Unexpected');
            return callback(err);
        }

        return callback(null, {id:id});
    };
    var wrapped = Memsource.cachingGet('test', options, getter);
    before(function(done) {
        options.client.flush(done);
    });
    it('getter 200 miss', function(done) {
        wrapped('asdf', function(err, data, headers) {
            assert.ifError(err);
            assert.deepEqual(data, {id:'asdf'}, 'returns data');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.asdf, 1, 'asdf IO x1');
            done();
        });
    });
    it('getter 200 hit', function(done) {
        wrapped('asdf', function(err, data, headers) {
            assert.ifError(err);
            assert.deepEqual(data, {id:'asdf'}, 'returns data');
            assert.deepEqual(headers, {'x-memcached-json':true, 'x-memcached':'hit'}, 'headers, hit');
            assert.equal(stats.asdf, 1, 'asdf IO x1');
            done();
        });
    });
    it('getter 404 miss', function(done) {
        wrapped('missing', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Not found', 'not found err');
            assert.equal(err.statusCode, 404, 'err code 404');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.missing, 1, 'missing IO x1');
            done();
        });
    });
    it('getter 404 hit', function(done) {
        wrapped('missing', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Not found', 'not found err');
            assert.equal(err.statusCode, 404, 'err code 404');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.missing, 1, 'missing IO x1');
            done();
        });
    });
    it('getter 500 miss', function(done) {
        wrapped('fatal', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Fatal', 'fatal err');
            assert.equal(err.statusCode, 500, 'err code 500');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.fatal, 1, 'fatal IO x1');
            done();
        });
    });
    it('getter 500 miss', function(done) {
        wrapped('fatal', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Fatal', 'fatal err');
            assert.equal(err.statusCode, 500, 'err code 500');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.fatal, 2, 'fatal IO x1');
            done();
        });
    });
    it('getter nocode', function(done) {
        wrapped('nocode', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Unexpected', 'unexpected err');
            assert.equal(err.statusCode, undefined, 'no err code');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.nocode, 1, 'nocode IO x1');
            done();
        });
    });
    it('getter nocode', function(done) {
        wrapped('nocode', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Unexpected', 'unexpected err');
            assert.equal(err.statusCode, undefined, 'no err code');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.nocode, 2, 'nocode IO x1');
            done();
        });
    });
});

describe('unit', function() {
    it('encode', function(done) {
        var errstat404 = new Error(); errstat404.statusCode = 404;
        var errstat403 = new Error(); errstat403.statusCode = 403;
        var errstat500 = new Error(); errstat500.statusCode = 500;
        assert.equal(Memsource.encode(errstat404), '404');
        assert.equal(Memsource.encode(errstat403), '403');
        assert.equal(Memsource.encode(errstat500), null);

        assert.ok(bufferEqual(Memsource.encode(null, {id:'foo'}), new Buffer(
            '{"x-memcached-json":true}' +
            new Array(1025 - '{"x-memcached-json":true}'.length).join(' ') +
            '{"id":"foo"}'
        )), 'encodes object');

        assert.ok(bufferEqual(Memsource.encode(null, 'hello world'), new Buffer(
            '{}' +
            new Array(1025 - '{}'.length).join(' ') +
            'hello world'
        ), 'encodes string'));

        assert.ok(bufferEqual(Memsource.encode(null, new Buffer(0)), new Buffer(
            '{}' +
            new Array(1025 - '{}'.length).join(' ') +
            ''
        ), 'encodes empty buffer'));

        assert.ok(bufferEqual(Memsource.encode(null, new Buffer(0), { 'content-type': 'image/png' }), new Buffer(
            '{"content-type":"image/png"}' +
            new Array(1025 - '{"content-type":"image/png"}'.length).join(' ') +
            ''
        ), 'encodes headers'));

        assert.throws(function() {
            Memsource.encode(null, new Buffer(0), { data: new Array(1024).join(' ') });
        }, Error, 'throws when headers exceed 1024 bytes');

        done();
    });
    it('decode', function(done) {
        assert.deepEqual(Memsource.decode('404'), {err:{statusCode:404,memcached:true}});
        assert.deepEqual(Memsource.decode('403'), {err:{statusCode:403,memcached:true}});

        var headers = JSON.stringify({'x-memcached-json':true,'x-memcached':'hit'});
        var encoded = new Buffer(
            headers +
            new Array(1025 - headers.length).join(' ') +
            JSON.stringify({'id':'foo'})
        );
        assert.deepEqual(Memsource.decode(encoded), {
            headers:{'x-memcached-json':true,'x-memcached':'hit'},
            buffer:{'id':'foo'}
        }, 'decodes object');

        var headers = JSON.stringify({'x-memcached':'hit'});
        var encoded = new Buffer(
            headers +
            new Array(1025 - headers.length).join(' ') +
            'hello world'
        );
        assert.deepEqual(Memsource.decode(encoded), {
            headers:{'x-memcached':'hit'},
            buffer: new Buffer('hello world'),
        }, 'decodes string (as buffer)');

        var headers = JSON.stringify({'x-memcached':'hit'});
        var encoded = new Buffer(
            headers +
            new Array(1025 - headers.length).join(' ') +
            ''
        );
        assert.deepEqual(Memsource.decode(encoded), {
            headers:{'x-memcached':'hit'},
            buffer: new Buffer(0),
        }, 'decodes empty buffer');

        done();
    });
});

