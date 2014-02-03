var assert = require('assert');
var mongodb = require('mongodb');

function MongoDb(mongoUri) {
    var self = this;

    assert(mongoUri, "Missing required parameter 'mongoUri'.");

    self.getCollection = function (callback) {
        mongodb.MongoClient.connect(mongoUri, function (err, db) {
            if (err) { return callback(err); }

            db.on('error', function (err) {
                return callback(err);
            });

            var collection = db.collection('singletons');

            collection.ensureIndex('name', { unique: true }, function (err) {
                if (err) { return callback(err); }

                return callback(null, collection);
            });
        });
    };

    self.closeConnection = function (collection, callback) {
        collection.db.on('close', function() {
            return callback();
        });

        collection.db.close();
    };

    self.fetchLock = function (collection, name, callback) {
        collection.findOne({ name: name }, function (err, lock) {
            if (err) { return callback(err); }

            return callback(null, lock);
        });
    }
}

MongoDb.prototype.persistLock = function (name, callback) {
    var self = this;

    self.getCollection(function (err, collection) {
        if (err) { return callback(err); }

        var doc = { 
            name: name, 
            created: new Date(),
        };
        collection.insert(doc, function (err, docs) {
            if (err) {
                if (err.name == 'MongoError' && err.code == 11000) {
                    self.fetchLock(collection, name, function (err, lock) {
                        self.closeConnection(collection, function() {
                            return callback(null, false, lock ? lock.created : null);
                        });
                    });
                } else {
                    return callback(err);
                }
            } else {
                self.closeConnection(collection, function() {
                    return callback(null, true);
                });
            }
        });     
    });
};

MongoDb.prototype.deleteLock = function (name, callback) {
    var self = this;

    self.getCollection(function (err, collection) {
        if (err) { return callback(err); }
        
        collection.remove({ name: name }, function (err) {
            if (err) { return callback(err); }

            self.closeConnection(collection, function() {
                return callback();
            });
        });
    }); 
};

MongoDb.prototype.lockExists = function (name, callback) {
    var self = this;

    self.getCollection(function (err, collection) {
        if (err) { return callback(err); }
        
        self.fetchLock(collection, name, function (err, lock) {
            self.closeConnection(collection, function() {
                return callback(null, lock ? true : false);
            });
        });
    }); 
};

module.exports = {
    MongoDb: MongoDb
};
