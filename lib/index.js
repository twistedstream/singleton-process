var util = require('util');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

function Singleton(name, persister) {
    var self = this;

    assert(persister, "Missing required parameter 'persister'.");

    self._name = name;
    self._persister = persister;
    self._isSigterm = false;
}
util.inherits(Singleton, EventEmitter);

Singleton.prototype.lock = function () {
    var self = this;

    self.emit('locking', "Attempting lock for singleton '" + self._name + "'.");

    self._persister.persistLock(self._name, function (err, success, conflictCreated) {
        if (err) { return self.emit('error', err); }

        if (success) {
            self.emit('locked', "Lock successfully obtained for singleton '" + self._name + "'.");

            // automatically release lock if process is signaled to be shut down
            process.on('SIGTERM', function() {
                self._isSigterm = true;
                self.release();
            });            
        } else {
            var message = conflictCreated
                          ? "A singleton already exists and was created on " + conflictCreated
                          : "A singleton existed at the moment this one was being locked but is no longer there.";
            return self.emit('conflict', message);            
        }
    });
};

Singleton.prototype.release = function () {
    var self = this;

    var message = self._isSigterm
                  ? "Attempting automatic lock release of singleton  '" + self._name + "' since the process received a SIGTERM event."
                  : "Attempting lock release of singleton '" + self._name + "'.";
    self.emit('releasing', message);

    self._persister.deleteLock(self._name, function (err) {
        if (err) { return self.emit('error', err); }

        self.emit('released', "Lock successfully released for singleton '" + self._name + "'.");

        if (self._isSigterm) {
            // exit so process doesn't keep processing
            process.exit();
        }
    });
};

module.exports = { 
	Singleton: Singleton,

    persisters: { 
        MongoDb: require('./persisters/mongo-db').MongoDb
    }
}
