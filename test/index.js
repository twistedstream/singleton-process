"use strict";

var should = require('chai').should();
var singletonProcess = require('../lib/index');
var moment = require('moment');

describe("Singleton class", function () {
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

    describe("'lock' method", function () {
        it("should fire 'locking' and 'locked' events when no lock exists", function (done) {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, true);
                }
            };

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

        it("should fire 'locking' and 'conflict' events when a lock already exists", function (done) {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, false, moment());
                }
            };

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

        it("should fire 'locking' and 'error' events when an error occurs while attempting a lock", function (done) {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(new Error("bad stuff"));
                }
            };

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

        //TODO: test expired lock scenarios
    });

    describe("'release' method", function () {
        it("should fire 'releasing' and 'released' events", function (done) {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, true);
                },
                deleteLock: function (name, callback) {
                    return callback(null, true);
                }
            };

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

        it("should fire 'releasing' and 'error' events when an error occurs while deleting a lock", function (done) {
            var persister = {
                persistLock: function (name, callback) {
                    return callback(null, true);
                },
                deleteLock: function (name, callback) {
                    return callback(new Error("broken bad"));
                }
            };

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

    describe("'exists' method", function () {
        it("should invoke callback with true if lock exists", function (done) {
            var persister = {
                lockExists: function (name, callback) {
                    return callback(null, true);
                }
            };

            var singleton = new singletonProcess.Singleton('foo', persister);

            singleton.exists(function (err, exists) {
                exists.should.be.true;
                done();
            });
        });

        it("should invoke callback with false if lock does not exist", function (done) {
            var persister = {
                lockExists: function (name, callback) {
                    return callback(null, false);
                }
            };

            var singleton = new singletonProcess.Singleton('foo', persister);

            singleton.exists(function (err, exists) {
                exists.should.be.false;
                done();
            });
        });

        it("should invoke callback with error if persister gave us an error", function (done) {
            var persister = {
                lockExists: function (name, callback) {
                    return callback(new Error("broken bad"));
                }
            };

            var singleton = new singletonProcess.Singleton('foo', persister);

            singleton.exists(function (err, exists) {
                err.message.should.equal("broken bad");
                done();
            });
        });

    });
});