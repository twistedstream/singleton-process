# singleton-process

Enforce a single instance of a node.js process across multiple hosts.

[![Build Status](https://travis-ci.org/twistedstream/singleton-process.svg?branch=master)](https://travis-ci.org/twistedstream/singleton-process)

## Installation

[![NPM](https://nodei.co/npm/singleton-process.png?downloads=true)](https://nodei.co/npm/singleton-process/)

## Usage

Here's the basic usage:

```js
var singletonProcess = require('singleton-process');

// create singleton instance with MongoDB persister and wire up events
var persister = new singletonProcess.persisters.MongoDb('mongodb://uri/to/your/mongo-db');
var singleton = new singletonProcess.Singleton('a-unique-singleton-name', persister);

singleton.on('locked', function() {
    // code to run once your singleton lock is obtained	
    ...
    // release the singleton lock when you're all done
    singleton.release();
});

singleton.on('conflict', function () {
    // code to run if you can't get a lock
    // this happens if another singleton instance (with same name) is currently running
    // usually you would just exit your process in this scenario
    ...
});

singleton.on('released', function () {
    // code to run when the lock is released
    // usually just exit the process
    ...
});

// now perform the lock to get things started
singleton.lock();
```

To ensure that your singleton instance releases its lock when an error occurs, use a Node.js [domain](http://nodejs.org/api/domain.html):

```js
var singletonProcess = require('singleton-process');
var domain = require('domain');

var sinlgeton = null;

var d = domain.create();
d.on('error', function (err) {
    // release the singleton lock if an error occurs
    if (singleton) {
        singleton.release();
    }
});

d.run(function() {
    // create the singleton inside the domain so that the 'error' event gets handled by the domain as well
    sinlgeton = new singletonProcess.Singleton(...);

    // singleton event handlers
    ...

    // perform the lock
	singleton.lock();
});
```

## Options

The `Singleton` constructor also takes an options parameter:

```js
var options = { lockExpireSeconds: 300 };
var singleton = new singletonProcess.Singleton(name, persister, options);
```

which currently supports the following attributes:

* `lockExpireSeconds`  
    All locks created by the `Singleton` instance will expire after the specified number of seconds so that lock creation attempts will automatically delete expired locks before creating new ones.  When an expired lock is deleted, the `expired` [event](#singleton-events) occcurs.

## Singleton Methods

* `lock()`  
Attempts to obtain a lock for the named singleton instance.  Handle the `locking`, `conflict`, `locked`, and `error` [events](#singleton-events) for asynchronous feedback from this call.
* `release()`  
Attempts to release an existing singleton lock.  Handle the `releasing`, `released`, and `error` [events](#singleton-events) for asynchronous feedback from this call.
* `exists(callback)`  
Determines if a named singleton instance currently exists.  
**Arguments**:
    * `callback(err, exists)`: A callback to invoke when the exist check is complete.  
    **Arguments**:
        * `err`: An error occurred while performing the check.
        * `exists`: `true` if the singleton exists; otherwise `false`.

## Singleton Events

* `'locking'`  
The `lock` method has been called and an attempt will now be made to aquire the lock.
* `'locked'`  
A lock has been successfully obtained.
* `'conflict'`  
The lock was not successful because another singleton currently has the lock.
* `'expired'`  
An expired lock was deleted, which will allow a new lock to be created.
* `'releasing'`
The `release` method has been called and an attempt will now be made to release the existing singleton lock.
* `'released'`  
The lock release was successful.
* `'error'`  
An error has occurred during locking or releasing of the singleton.

All events (except `error`) return a `message` parameter that can be used for logging.  The `error` event returns the standard `err` object.

## Persisters

Locking is performed by persisting state to a shared data store.  **singleton-process** comes with following persisters:

* **MongoDB**: Created using the `singletonProcess.persisters.MongoDb` class (as shown in the [usage](#usage) example above).

Please feel free to fork the repo and add more!

A persister class should provide the following interface:

* Method: `persistLock(name, callback)`  
Atomically save a lock to the data store.  
**Arguments**:
    * `name`: The name of the lock to persist.
    * `callback(err, success, conflictCreated)`: A callback to invoke when persistence is complete.  
    **Arguments**:
        * `err`: An error object if an error occurs during persistence.
        * `success`: `true` if the lock was successfully persisted; `false` if an existing lock prevented the persistence.
        * `conflictCreated`: if the lock was not successful, the date that the existing lock was created or `null` if that can't be determined. 
* Method: `deleteLock(name, callback)`  
Atomically remove an existing lock.  
**Arguments**:
    * `name`: The name of the lock to delete.
    * `callback(err)`: A callback to invoke when the lock removal is complete.  
    **Arguments**:
        * `err`: An error object if an error occurs during lock removal.
* Method: `lockExists(name, callback)`  
Queries the data store to check for the existance of a lock.  
**Arguments**:
    * `name`: The name of the lock to check.
    * `callback(err, exists)`: A callback to invoke when the check is complete.  
    **Arguments**:
        * `err`: An error object if an error occurs during the check.
        * `exists`: `true` if the lock exists; otherwise `false`.
