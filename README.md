[![Build Status](https://travis-ci.org/mapbox/tilelive-memcached.png?branch=master)](https://travis-ci.org/mapbox/tilelive-memcached)

tilelive-memcached
------------------
node-tilejson wrapping source for tilelive.

    var options = {
        client: client, // optional, instantiated memcached client
        expires: 600    // optional, object expiration time in seconds
    };
    var TileJSON = require('tilelive-memcached')(options, requre('tilejson'));

    new TileJSON( ... )
