[![Build Status](https://travis-ci.org/mapbox/tilelive-memcached.png?branch=master)](https://travis-ci.org/mapbox/tilelive-memcached)

tilelive-memcached
------------------
node-tilejson wrapping source for tilelive.

    var options = {
        mode: 'readthrough', // optional, cache mode either 'readthrough' or 'race'
        client: client, // optional, instantiated memcached client
        expires: 600    // optional, object expiration time in seconds
        ttl: 300        // optional, relay mode only, numbe of seconds before an object should be re-checked.
    };
    var TileJSON = require('tilelive-memcached')(options, require('tilejson'));

    new TileJSON( ... )

### Cache modes

Two modes for caching are available.

- **readthrough** hits memcached first and only calls a `get` on the original source if a cache miss occurs.
- **race** always hits both memcached and the original source concurrently. The IO operation that completes fastest will handle the `get` call. After both operations are complete the cache may be updated if the original source's contents have changed.
