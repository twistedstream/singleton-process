"use strict";

require('mocha');
var should = require('chai').should();
var proxyquire =  require('proxyquire');
var mongoClient = {};
var providers = proxyquire('../lib/persisters/mongo-db', {
    mongodb: {
        MongoClient: mongoClient
    }
});

function createConnectionWithError (errorMessage) {
    mongoClient.connect = function (uri, callback) {
        callback(new Error(errorMessage));
    };
}

function createConnection (collectionDecorator) {
    var db = {};
    db.on = function (event, listener) { 
        if (event == 'close') {
            this._closeListener = listener;
        }
    };
    db.close = function () {
        if (this._closeListener) {
            this._closeListener();
        }
    };
    db.collection = function (name) {
        var col = {
            db: db,
            ensureIndex: function (name, options, callback) {
                callback();
            }
        };

        collectionDecorator(col);

        return col;
    };

    mongoClient.connect = function (uri, callback) {
        callback(null, db);
    };
}

describe("MongoDb", function () {
    describe("constructor", function () {
        it("should require 'mongoUri' parameter", function (done) {
            (function () {
                new providers.MongoDb();
            }).should.throw(/'mongoUri'/);
            done();
        });
    });

    describe("#persistLock method", function () {
        it("should require 'name' parameter", function (done) {
            var provider = new providers.MongoDb('foo-url');

            (function () {
                provider.persistLock();
            }).should.throw(/'name'/);
            done();
        });

        it("should require 'callback' parameter", function (done) {
            var provider = new providers.MongoDb('foo-url');

            (function () {
                provider.persistLock('foo');
            }).should.throw(/'callback'/);
            done();
        });

        it("when no lock row exists: should insert a row and invoke the callback with true", function (done) {
            var rowInserted = false;

            createConnection(function (collection) {
                collection.insert = function (doc, callback) {
                    rowInserted = true;

                    callback();
                };
            });

            var provider = new providers.MongoDb('foo-url');
            provider.persistLock('foo', function (err, success) {
                rowInserted.should.equal(true);
                success.should.equal(true);
                done();
            });          
        });

        it("when a lock row already exists: should handle the MongoDB 'duplicate key error' and invoke the callback with false and created date", function (done) {
            var lockCreated = Date.now();

            createConnection(function (collection) {
                collection.insert = function (doc, callback) {
                    callback({
                        name: 'MongoError', 
                        code: 11000
                    });
                };

                collection.findOne = function (query, callback) {
                    callback(null, { created: lockCreated });
                };
            });

            var provider = new providers.MongoDb('foo-url');
            provider.persistLock('foo', function (err, success, created) {
                success.should.equal(false);
                created.should.equal(lockCreated);
                done();
            });          
        });

        it("when a non-duplicate key insert error occurs: should invoke the callback with the error", function (done) {
            createConnectionWithError("bad foo!");

            var provider = new providers.MongoDb('foo-url');
            provider.persistLock('foo', function (err) {
                err.message.should.equal("bad foo!");
                done();
            });          
        });
    });

    describe("#deleteLock method", function () {
        it("should require 'name' parameter", function (done) {
            var provider = new providers.MongoDb('foo-url');

            (function () {
                provider.deleteLock();
            }).should.throw(/'name'/);
            done();
        });

        it("should require 'callback' parameter", function (done) {
            var provider = new providers.MongoDb('foo-url');

            (function () {
                provider.deleteLock('foo');
            }).should.throw(/'callback'/);
            done();
        });

        it("when no delete error occurs: should remove any existing row and invoke the callback", function (done) {
            var rowDeleted = false;

            createConnection(function (collection) {
                collection.remove = function (query, callback) {
                    rowDeleted = true;

                    callback();
                };
            });

            var provider = new providers.MongoDb('foo-url');
            provider.deleteLock('foo', function (err) {
                rowDeleted.should.equal(true);
                done();
            });          
        });

        it("when a delete error occurs: should invoke the callback with the error", function (done) {
            createConnectionWithError("bad foo!");

            var provider = new providers.MongoDb('foo-url');
            provider.deleteLock('foo', function (err) {
                err.message.should.equal("bad foo!");
                done();
            });          
        });
    });

    describe("#lockExists method", function () {
        it("should require 'name' parameter", function (done) {
            var provider = new providers.MongoDb('foo-url');

            (function () {
                provider.lockExists();
            }).should.throw(/'name'/);
            done();
        });

        it("should require 'callback' parameter", function (done) {
            var provider = new providers.MongoDb('foo-url');

            (function () {
                provider.lockExists('foo');
            }).should.throw(/'callback'/);
            done();
        });

        it("when a lock row exists: should invoke the callback with true", function (done) {
            createConnection(function (collection) {
                collection.findOne = function (query, callback) {
                    callback(null, { created: Date.now() });
                };
            });

            var provider = new providers.MongoDb('foo-url');
            provider.lockExists('foo', function (err, exists) {
                exists.should.equal(true);
                done();
            });          
        });

        it("when no lock row exists: should invoke the callback with false", function (done) {
            createConnection(function (collection) {
                collection.findOne = function (query, callback) {
                    callback(null, null);
                };
            });

            var provider = new providers.MongoDb('foo-url');
            provider.lockExists('foo', function (err, exists) {
                exists.should.equal(false);
                done();
            });                      
        });

        it("when a find error occurs: should invoke the callback with the error", function (done) {
            createConnectionWithError("bad foo!");

            var provider = new providers.MongoDb('foo-url');
            provider.lockExists('foo', function (err) {
                err.message.should.equal("bad foo!");
                done();
            });          
        });
    });
});
