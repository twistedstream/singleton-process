"use strict";

require('mocha');
var should = require('chai').should();
var singletonProcess = require('../lib/index');
var moment = require('moment');

describe("Singleton", function () {
    afterEach(function (done) {
        // remove process SIGTERM listeners since each test creates one and we'll end up exceeding the limit
        process.removeAllListeners('SIGTERM');
        done();
    });

    describe("constructor", function () {
        it("should require name parameter", function (done) {
            (function () {
                new singletonProcess.Singleton();
            }).should.throw(/'name'/);
            done();
        });

        it("should require persister parameter", function (done) {
            (function () {
                new singletonProcess.Singleton('foo');
            }).should.throw(/'persister'/);
            done();
        });
    });

    describe("#lock method", function () {
        describe("when no lock exists:", function () {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    persistLock: function (name, callback) {
                        return callback(null, true);
                    }
                });
            };

            it("should fire 'locking' and 'locked' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('locked', function () {
                    events += 'locked';

                    events.should.equal('lockinglocked');
                    done();
                });

                singleton.lock();
            });

            it("should invoke the callback with true", function (done) {
                var singleton = singletonFactory();

                singleton.lock(function (err, success) {
                    success.should.equal(true);
                    done();
                });
            });

            it("should return a fulfilled promise with true", function (done) {
                var singleton = singletonFactory();

                singleton.lock().then(function (success) {
                    success.should.equal(true);
                    done();
                });
            });
        });

        describe("when a lock already exists:", function () {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    persistLock: function (name, callback) {
                        return callback(null, false, moment());
                    }
                });
            };

            it("should fire 'locking' and 'conflict' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('conflict', function () {
                    events += 'conflict';

                    events.should.equal('lockingconflict');
                    done();
                });

                singleton.lock();
            });

            it("should invoke the callback with false", function (done) {
                var singleton = singletonFactory();

                singleton.lock(function (err, success) {
                    success.should.equal(false);
                    done();
                });
            });

            it("should return a fulfilled promise with false", function (done) {
                var singleton = singletonFactory();

                singleton.lock().then(function (success) {
                    success.should.equal(false);
                    done();
                });
            });
        });

        describe("when an error occurs while attempting a lock:", function () {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    persistLock: function (name, callback) {
                        return callback(new Error("bad stuff"));
                    }
                });
            };

            it("should fire 'locking' and 'error' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('error', function (err) {
                    events += 'err';

                    events.should.equal('lockingerr');
                    err.message.should.equal("bad stuff");
                    done();
                });

                singleton.lock();
            });

            it("should invoke the callback with the error", function (done) {
                var singleton = singletonFactory();

                singleton.lock(function (err, success) {
                    err.message.should.equal("bad stuff");
                    done();
                });
            });

            it("should return a rejected promise", function (done) {
                var singleton = singletonFactory();

                singleton.lock().then(null, function (err) {
                    err.message.should.equal("bad stuff");
                    done();
                });
            });
        });

        describe("when an expired lock exists:", function () {
            var singletonFactory = function() {
                var persister = {
                    persistLock: function (name, callback) {
                        return callback(null, false, moment().subtract(1, 'hour'));
                    },
                    deleteLock: function (name, callback) {
                        return callback();
                    }
                };

                var singleton = new singletonProcess.Singleton('foo', persister, { lockExpireSeconds: 300});
                singleton.on('expired', function () {
                    persister.persistLock = function (name, callback) {
                        return callback(null, true);
                    };
                });

                return singleton;                                
            };

            it("should fire 'locking', 'expired', and 'locked' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('expired', function () {
                    events += 'expired';
                });
                singleton.on('locked', function () {
                    events += 'locked';

                    events.should.equal('lockingexpiredlocked');
                    done();
                });

                singleton.lock();
            });

            it("should invoke the callback with true", function (done) {
                var singleton = singletonFactory();

                singleton.lock(function (err, success) {
                    success.should.equal(true);
                    done();
                });
            });

            it("should return a fulfilled promise with true", function (done) {
                var singleton = singletonFactory();

                singleton.lock().then(function (success) {
                    success.should.equal(true);
                    done();
                });
            });
        });

        describe("when a non-expired lock already exists:", function () {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    persistLock: function (name, callback) {
                        return callback(null, false, moment().add(1, 'hour'));
                    }
                }, 
                { lockExpireSeconds: 300});
            };

            it("should fire 'locking' and 'conflict' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('conflict', function () {
                    events += 'conflict';

                    events.should.equal('lockingconflict');
                    done();
                });

                singleton.lock();
            });

            it("should invoke the callback with false", function (done) {
                var singleton = singletonFactory();

                singleton.lock(function (err, success) {
                    success.should.equal(false);
                    done();
                });
            });

            it("should return a fulfilled promise with false", function (done) {
                var singleton = singletonFactory();

                singleton.lock().then(function (success) {
                    success.should.equal(false);
                    done();
                });
            });
        });

        describe("when an expired lock exists and a new lock is attempted but fails:", function () {
            var singletonFactory = function() {
                var persister = {
                    persistLock: function (name, callback) {
                        return callback(null, false, moment().subtract(1, 'hour'));
                    },
                    deleteLock: function (name, callback) {
                        return callback();
                    }
                };

                var singleton = new singletonProcess.Singleton('foo', persister, { lockExpireSeconds: 300});
                singleton.on('expired', function () {
                    persister.persistLock = function (name, callback) {
                        return callback(null, false, moment().add(1, 'hour'));
                    };
                });

                return singleton;                                
            };

            it("should fire 'locking', 'expired', and 'conflict' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('expired', function () {
                    events += 'expired';
                });
                singleton.on('conflict', function () {
                    events += 'conflict';

                    events.should.equal('lockingexpiredconflict');
                    done();
                });

                singleton.lock();
            });

            it("should invoke the callback with false", function (done) {
                var singleton = singletonFactory();

                singleton.lock(function (err, success) {
                    success.should.equal(false);
                    done();
                });
            });

            it("should return a fulfilled promise with false", function (done) {
                var singleton = singletonFactory();

                singleton.lock().then(function (success) {
                    success.should.equal(false);
                    done();
                });
            });
        });

        describe("when an expired lock exists and a new lock is attempted but the persister has an error:", function () {
            var singletonFactory = function() {
                var persister = {
                    persistLock: function (name, callback) {
                        return callback(null, false, moment().subtract(1, 'hour'));
                    },
                    deleteLock: function (name, callback) {
                        return callback();
                    }
                };

                var singleton = new singletonProcess.Singleton('foo', persister, { lockExpireSeconds: 300});
                singleton.on('expired', function () {
                    persister.persistLock = function (name, callback) {
                        return callback(new Error("breaking bad"));
                    };
                });

                return singleton;                                
            };

            it("should fire 'locking', 'expired', and 'error' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('expired', function () {
                    events += 'expired';
                });
                singleton.on('error', function (err) {
                    events += 'err';

                    events.should.equal('lockingexpirederr');
                    err.message.should.equal("breaking bad");
                    done();
                });

                singleton.lock();
            });

            it("should invoke the callback with the error", function (done) {
                var singleton = singletonFactory();

                singleton.lock(function (err, success) {
                    err.message.should.equal("breaking bad");
                    done();
                });
            });

            it("should return a rejected promise", function (done) {
                var singleton = singletonFactory();

                singleton.lock().then(null, function (err) {
                    err.message.should.equal("breaking bad");
                    done();
                });
            });        
        });
    });

    describe("#release method", function () {
        describe("when no error occurs while deleting a lock:", function() {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    deleteLock: function (name, callback) {
                        return callback(null, true);
                    }
                });
            };

            it("should fire 'releasing' and 'released' events", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('releasing', function () {
                    events += 'releasing';
                });
                singleton.on('released', function () {
                    events += 'released';

                    events.should.equal('releasingreleased');
                    done();
                });

                singleton.release();
            });

            it("should invoke the callback", function (done) {
                var singleton = singletonFactory();

                singleton.release(function (err) {
                    done();
                });                      
            });

            it("should return a fulfilled promise with null", function (done) {
                var singleton = singletonFactory();

                singleton.release().then(function (value) {
                    should.not.exist(value);
                    done();
                });
            });
        });

        describe("when an error occurs while deleting a lock:", function () {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    deleteLock: function (name, callback) {
                        return callback(new Error("broken bad"));
                    }
                });
            };

            it("should fire 'releasing' and 'error' events ", function (done) {
                var singleton = singletonFactory();

                var events = '';
                singleton.on('releasing', function () {
                    events += 'releasing';
                });
                singleton.on('error', function (err) {
                    events += 'err';

                    events.should.equal('releasingerr');
                    err.message.should.equal("broken bad");
                    done();
                });

                singleton.release();
            });

            it("should invoke the callback with the error", function (done) {
                var singleton = singletonFactory();

                singleton.release(function (err, success) {
                    err.message.should.equal("broken bad");
                    done();
                });                      
            });

            it("should return a rejected promise", function (done) {
                var singleton = singletonFactory();

                singleton.release().then(null, function (err) {
                    err.message.should.equal("broken bad");
                    done();
                });
            });
        });
    });

    describe("#exists method", function () {
        describe("when a lock exists:", function() {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    lockExists: function (name, callback) {
                        return callback(null, true);
                    }
                });
            };

            it("should invoke the callback with true", function (done) {
                var singleton = singletonFactory();

                singleton.exists(function (err, exists) {
                    exists.should.equal(true);
                    done();
                });
            });

            it("should return a fulfilled promise with true", function (done) {
                var singleton = singletonFactory();

                singleton.exists().then(function(exists) {
                    exists.should.equal(true);
                    done();
                });
            });
        });

        describe("when a lock doesn't exist:", function() {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    lockExists: function (name, callback) {
                        return callback(null, false);
                    }
                });
            };

            it("should invoke the callback with false", function (done) {
                var singleton = singletonFactory();

                singleton.exists(function (err, exists) {
                    exists.should.equal(false);
                    done();
                });
            });

            it("should return a fulfilled promise with false", function (done) {
                var singleton = singletonFactory();

                singleton.exists().then(function(exists) {
                    exists.should.equal(false);
                    done();
                });
            });
        });

        describe("when the lock check results in an error:", function() {
            var singletonFactory = function() {
                return new singletonProcess.Singleton('foo', {
                    lockExists: function (name, callback) {
                        return callback(new Error("broken bad"));
                    }
                });
            };

            it("should invoke the callback with the error ", function (done) {
                var singleton = singletonFactory();

                singleton.exists(function (err, exists) {
                    err.message.should.equal("broken bad");
                    done();
                });
            });

            it("should return a rejected promise", function (done) {
                var singleton = singletonFactory();

                singleton.exists().then(null, function (err) {
                    err.message.should.equal("broken bad");
                    done();
                });
            });
        });        
    });
});