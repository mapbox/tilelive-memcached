module.exports = Testsource;

var now = new Date;
var tiles = {
    a: require('fs').readFileSync(__dirname + '/a.png'),
    b: require('fs').readFileSync(__dirname + '/b.png'),
};

var grids = {
    a: { grid:'', keys: ['', '1' ], data:{'1': {'name':'foo'}} },
    b: { grid:'', keys: ['', '1' ], data:{'1': {'name':'bar'}} },
};

Testsource.now = new Date;
Testsource.tiles = tiles;
Testsource.grids = grids;

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


