# singleton-process

Enforce a single instance of a node.js process across multiple hosts.

Currently persistence is performed exclusively with MongoDB.

## Installation

```bash
npm install singleton-process
```

## Usage

```js
var singletonProcess = require('singleton-process');

// create singleton instance and wire up events
var singleton = new singletonProcess.Singleton(
    'a-unique-singleton-name', 
    'mongodb://uri/to/your/mongo-db');

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

## Singleton Methods

* `lock()` Attempts to obtain a lock for the named singleton instance.
* `release()` Attempts to release an existing singleton lock.

## Singleton Events

* `locking` The `lock` method has been called and an attempt will now be made to aquire the lock.
* `locked` A lock has been successfully obtained.
* `conflict` The lock was not successful because another singleton currently has the lock.
* `releasing` The `release` method has been called and an attempt will now be made to release the existing singleton lock.
* `released` The lock release was successful.
* `error` An error has occurred during locking or releasing of the singleton.

All events (except `error`) return a `message` parameter that can be used for logging.  The `error` event returns the standard `err` object.
