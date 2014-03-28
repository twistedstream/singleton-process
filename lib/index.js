"use strict";

var RSVP = require('rsvp');
var util = require('util');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var moment = require('moment');

function Singleton(name, persister, options) {
    var self = this;

    assert(name, "Missing required parameter 'name'.");
    assert(persister, "Missing required parameter 'persister'.");

    self._name = name;
    self._persister = persister;
    self._options = options || {};
    self._isSigterm = false;
}
util.inherits(Singleton, EventEmitter);

Singleton.prototype.lock = function (callback) {
    var self = this;

    self.emit('locking', "Attempting lock for singleton '" + self._name + "'.");

    function persistLock(resolve, reject, onConflct) {
        self._persister.persistLock(self._name, function (err, success, conflictCreated) {
            if (err) { 
                reject(err); 
            } else {
                if (success) {
                    // automatically release lock if process is signaled to be shut down
                    process.on('SIGTERM', function () {
                        self._isSigterm = true;
                        self.release();
                    });

                    self.emit('locked', "Lock successfully obtained for singleton '" + self._name + "'.");
                    resolve(true);
                } else {
                    if (!conflictCreated) {
                        self.emit('conflict',
                            "A singleton existed at the moment this one was being locked but is no longer there.");
                        resolve(false);
                    } else {
                        // convert to moment
                        conflictCreated = moment(conflictCreated);

                        onConflct(conflictCreated);
                    }
                }
            }
        });
    }

    var promise = new RSVP.Promise(function (resolve, reject) {
        persistLock(resolve, reject, function (conflictCreated) {
            // determine if lock is expired
            if (self._options.lockExpireSeconds &&
                // expired = it's now after the lock time plus its expiration age
                moment().isAfter(moment(conflictCreated).add('seconds', self._options.lockExpireSeconds))) {

                // delete lock
                self._persister.deleteLock(self._name, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        self.emit('expired', "Automatically deleted expired lock (created " + conflictCreated.format() + ") for singleton '" + self._name + "'.");

                        // attempt lock again
                        persistLock(resolve, reject, function (newConflictCreated) {
                            self.emit('conflict',
                                "An expired lock (created " + conflictCreated.format() + ") for singleton '" + self._name + "' was deleted, but when an attempt to create a new lock was made, another lock (created " + newConflictCreated.format() + ") existed.");

                            resolve(false);
                        });
                    }
                });
            } else {
                self.emit('conflict',
                    "A non-expired lock (created " + conflictCreated.format() + ") for singleton '" + self._name + "' already exists.");
                resolve(false);
            }
        });
    });

    promise.catch(function (err) {
        self.emit('error', err);
    });

    if (callback) {
        promise.then(function (success) {
            callback(null, success);
        }).catch(function (err) {
            callback(err);
        });
    }

    return promise;
};

Singleton.prototype.release = function (callback) {
    var self = this;

    var message = self._isSigterm ?
        "Attempting automatic lock release of singleton  '" + self._name + "' since the process received a SIGTERM event." :
        "Attempting lock release of singleton '" + self._name + "'.";
    self.emit('releasing', message);


    var promise = new RSVP.Promise(function (resolve, reject) {
        self._persister.deleteLock(self._name, function (err) {
            if (err) {
                reject(err);
            } else {
                self.emit('released', "Lock successfully released for singleton '" + self._name + "'.");
                resolve();

                if (self._isSigterm) {
                    // exit so process doesn't keep processing
                    process.exit();
                }
            }
        });
    });

    promise.catch(function (err) {
        self.emit('error', err);
    });

    if (callback) {
        promise.then(function () {
            callback(null);
        }).catch(function (err) {
            callback(err);
        });
    }

    return promise;
};

Singleton.prototype.exists = function (callback) {
    var self = this;

    var promise = new RSVP.Promise(function (resolve, reject) {
        self._persister.lockExists(self._name, function (err, exists) {
            if (err) {
                reject(err);
            } else {
                resolve(exists);
            }
        });
    });

    if (callback) {
        promise.then(function (exists) {
            callback(null, exists);
        }).catch(function (err) {
            callback(err);
        });
    }

    return promise;
};

module.exports = {
    Singleton: Singleton,

    persisters: {
        MongoDb: require('./persisters/mongo-db').MongoDb
    }
};
