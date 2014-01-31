# singleton-process

Enforce a single instance of a node.js process across multiple hosts.

## Installation

```bash
npm install singleton-process
```

## Usage

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

## Singleton Methods

* `lock()`: Attempts to obtain a lock for the named singleton instance.
* `release()`: Attempts to release an existing singleton lock.

## Singleton Events

* `locking`: The `lock` method has been called and an attempt will now be made to aquire the lock.
* `locked`: A lock has been successfully obtained.
* `conflict`: The lock was not successful because another singleton currently has the lock.
* `releasing`: The `release` method has been called and an attempt will now be made to release the existing singleton lock.
* `released`: The lock release was successful.
* `error`: An error has occurred during locking or releasing of the singleton.

All events (except `error`) return a `message` parameter that can be used for logging.  The `error` event returns the standard `err` object.

## Persisters

Locking is performed by persisting state to a shared data store.  **singleton-process** comes with following persisters:

* **MongoDB**: Created using the `singletonProcess.persisters.MongoDb` class (as shown in the [usage](#usage) example above).

Please feel free to fork the repo and add more!

A persister class should provide the following interface:

* `persistLock` function: Atomically save a lock to the data store with the following arguments:
    * `name`: The name of the lock to persist.
    * `callback`: A callback to invoke when persistence is complete that has the following arguments:
        * `err`: An error object if an error occurs during persistence.
        * `success`: `true` if the lock was successfully persisted; `false` if an existing lock prevented the persistence.
        * `conflictCreated`: if the lock was not successful, the date that the existing lock was created or `null` if that can't be determined. 
* `deleteLock` function: Atomically remove an existing lock from the data store with the following arguments:
    * `name`: The name of the lock to delete.
    * `callback`: A callback to invoke when the lock removal is complete that has the following arguments:
        * `err`: An error object if an error occurs during lock removal.
