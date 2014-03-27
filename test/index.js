"use strict";

require('mocha');
var should = require('chai').should();
var singletonProcess = require('../lib/index');
var moment = require('moment');

describe("Singleton", function () {
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
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, true);
                }
            };

            it("should fire 'locking' and 'locked' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

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
        });

        describe("when a lock already exists:", function () {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, false, moment());
                }
            };

            it("should fire 'locking' and 'conflict' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

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
        });

        describe("when an error occurs while attempting a lock:", function () {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(new Error("bad stuff"));
                }
            };

            it("should fire 'locking' and 'error' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

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
        });

        describe("when an expired lock exists:", function () {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, false, moment().subtract(1, 'hour'));
                },
                deleteLock: function (name, callback) {
                    return callback();
                }
            };

            it("should fire 'locking', 'expired', and 'locked' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister, { lockExpireSeconds: 300});

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('expired', function () {

                    events += 'expired';

                    persister.persistLock = function (name, callback) {
                        return callback(null, true);
                    };
                });
                singleton.on('locked', function () {
                    events += 'locked';

                    events.should.equal('lockingexpiredlocked');
                    done();
                });

                singleton.lock();
            });
        });

        describe("when a non-expired lock already exists:", function () {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, false, moment().add(1, 'hour'));
                }
            };

            it("should fire 'locking' and 'conflict' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister, { lockExpireSeconds: 300});

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
        });

        describe("when an expired lock exists and a new lock is attempted but fails:", function () {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, false, moment().subtract(1, 'hour'));
                },
                deleteLock: function (name, callback) {
                    return callback();
                }
            };

            it("should fire 'locking', 'expired', and 'conflict' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister, { lockExpireSeconds: 300});

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('expired', function () {

                    events += 'expired';

                    persister.persistLock = function (name, callback) {
                        return callback(null, false, moment().add(1, 'hour'));
                    };
                });
                singleton.on('conflict', function () {
                    events += 'conflict';

                    events.should.equal('lockingexpiredconflict');
                    done();
                });

                singleton.lock();
            });
        });

        describe("when an expired lock exists and a new lock is attempted but the persister has an error:", function () {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, false, moment().subtract(1, 'hour'));
                },
                deleteLock: function (name, callback) {
                    return callback();
                }
            };

            it("should fire 'locking', 'expired', and 'error' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister, { lockExpireSeconds: 300});

                var events = '';
                singleton.on('locking', function () {
                    events += 'locking';
                });
                singleton.on('expired', function () {

                    events += 'expired';

                    persister.persistLock = function (name, callback) {
                        return callback(new Error("breaking bad"));
                    };
                });
                singleton.on('error', function (err) {
                    events += 'err';

                    events.should.equal('lockingexpirederr');
                    err.message.should.equal("breaking bad");
                    done();
                });

                singleton.lock();
            });
        });
    });

    describe("#release method", function () {
        describe("when a lock exists:", function() {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, true);
                },
                deleteLock: function (name, callback) {
                    return callback(null, true);
                }
            };

            it("should fire 'releasing' and 'released' events", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

                var events = '';

                singleton.on('locked', function () {
                    singleton.release();
                });
                singleton.on('releasing', function () {
                    events += 'releasing';
                });
                singleton.on('released', function () {
                    events += 'released';

                    events.should.equal('releasingreleased');
                    done();
                });

                singleton.lock();
            });
        });

        describe("when a lock doesn't exist:", function() { 
            //TODO: write tests
        });

        describe("when an error occurs while deleting a lock:", function () {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, true);
                },
                deleteLock: function (name, callback) {
                    return callback(new Error("broken bad"));
                }
            };

            it("should fire 'releasing' and 'error' events ", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

                var events = '';

                singleton.on('locked', function () {
                    singleton.release();
                });
                singleton.on('releasing', function () {
                    events += 'releasing';
                });
                singleton.on('error', function (err) {
                    events += 'err';

                    events.should.equal('releasingerr');
                    err.message.should.equal("broken bad");
                    done();
                });

                singleton.lock();
            });
        });
    });

    describe("#exists method", function () {
        describe("when a lock exists:", function() {
            var persister = {
                lockExists: function (name, callback) {
                    return callback(null, true);
                }
            };

            it("should invoke the callback with true", function (done) {

                var singleton = new singletonProcess.Singleton('foo', persister);

                singleton.exists(function (err, exists) {
                    exists.should.equal(true);
                    done();
                });
            });

            it("should return a fulfilled promise with true", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

                singleton.exists().then(function(exists) {
                    exists.should.equal(true);
                    done();
                });
            });
        });

        describe("when a lock doesn't exist:", function() {
            var persister = {
                lockExists: function (name, callback) {
                    return callback(null, false);
                }
            };

            it("should invoke the callback with false", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

                singleton.exists(function (err, exists) {
                    exists.should.equal(false);
                    done();
                });
            });

            it("should return a fulfilled promise with false", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

                singleton.exists().then(function(exists) {
                    exists.should.equal(false);
                    done();
                });
            });
        });

        describe("when the lock check results in an error:", function() {
            var persister = {
                lockExists: function (name, callback) {
                    return callback(new Error("broken bad"));
                }
            };

            it("should invoke the callback with the error ", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

                singleton.exists(function (err, exists) {
                    err.message.should.equal("broken bad");
                    done();
                });
            });

            it("should return a rejected promise", function (done) {
                var singleton = new singletonProcess.Singleton('foo', persister);

                singleton.exists().then(null, function (err) {
                    err.message.should.equal("broken bad");
                    done();
                });
            });
        });        
    });
});