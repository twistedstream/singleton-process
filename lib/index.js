var util = require('util');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var mongodb = require('mongodb');

function Singleton(name, mongoUri) {
    var self = this;

    assert(mongoUri, "Missing required parameter 'mongoUri'.");

    self._name = name;
    self._isSigterm = false;

    self.getCollection = function (callback) {
        mongodb.MongoClient.connect(mongoUri, function (err, db) {
            if (err) { return callback(err); }

            db.on('error', function (err) {
                self.emit('error', err);
            });

            var collection = db.collection('singletons');

            collection.ensureIndex('name', { unique: true }, function (err) {
                if (err) { return callback(err); }

                return callback(null, collection);
            });
        });
    }
}
util.inherits(Singleton, EventEmitter);

function closeConnection(collection, callback) {
    collection.db.on('close', function() {
        return callback();
    });

    collection.db.close();
}

Singleton.prototype.lock = function () {
    var self = this;

    self.emit('locking', "Attempting lock for singleton '" + self._name + "'.");

    self.getCollection(function (err, collection) {
        if (err) { return self.emit('error', err); }

        var doc = { 
            name: self._name, 
            created: new Date(),
        };
        collection.insert(doc, function (err, docs) {
            if (err) {
                if (err.name == 'MongoError' && err.code == 11000) {
                    collection.findOne({ name: self._name }, function (err, existing) {
                        if (err) { return self.emit('error', err); }

                        closeConnection(collection, function() {
                            var message = existing
                                          ? "A singleton already exists and was created on " + existing.created
                                          : "A singleton existed at the moment this one was being locked but is no longer there.";
                            return self.emit('conflict', message);
                        });
                    });
                } else {
                    return self.emit('error', err);
                }
            } else {
                closeConnection(collection, function() {
                    self.emit('locked', "Lock successfully obtained for singleton '" + self._name + "'.");

                    // automatically release lock if process is signaled to be shut down
                    process.on('SIGTERM', function() {
                        self._isSigterm = true;
                        self.release();
                    });
                });
            }
        });
    });
};

Singleton.prototype.release = function () {
    var self = this;

    var message = self._isSigterm
                  ? "Attempting automatic lock release of singleton  '" + self._name + "' since the process received a SIGTERM event."
                  : "Attempting lock release of singleton '" + self._name + "'.";
    self.emit('releasing', message);

    self.getCollection(function (err, collection) {
        if (err) { return self.emit('error', err); }

        collection.remove({ name: self._name }, function (err) {
            if (err) { return self.emit('error', err); }

            closeConnection(collection, function() {
                self.emit('released', "Lock successfully released for singleton '" + self._name + "'.");

                if (self._isSigterm) {
                    // exit so process doesn't keep processing
                    process.exit();
                }
            });
        });
    });
};

module.exports = { 
	Singleton: Singleton
}
