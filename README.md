# singleton-process

Enforce a single instance of a node.js process across multiple hosts.

[![Build Status](https://travis-ci.org/twistedstream/singleton-process.svg?branch=master)](https://travis-ci.org/twistedstream/singleton-process)

## Installation

[![NPM](https://nodei.co/npm/singleton-process.png?downloads=true)](https://nodei.co/npm/singleton-process/)

## Usage

Start by creating a `Singleton` instance, passing in the desired [Persister](#persisters):

```js
var singletonProcess = require('singleton-process');

// create MongoDB persister
var persister = new singletonProcess.persisters.MongoDb('mongodb://uri/to/your/mongo-db');

// create singleton instance with the persister
var singleton = new singletonProcess.Singleton('a-unique-singleton-name', persister);
```

If you're hip to [Promises](http://promises-aplus.github.io/promises-spec/), then a typical workflow looks like this:

```js
singleton.lock()
    .then(function (success) {
        if (success) {
            // a lock was obtained!
            
            // protected code block to execute within lock
            ...
            
            // don't forget release the singleton lock when you're all done
            return singleton.release();        
        } else {
            // a lock already exists!
            
            // maybe log something
            ...
        }
    })
    .then(function() {
        // code to run when the lock is released (or was never obtained)
        // usually just exit the process
        ...    
    })
    .catch(function(err) {
        // yikes! an error occured during the lock or unlock process
        
        // probably should log it
        ...
    });
```

**NOTE:**  
**singleton-process** uses the [RSVP](https://github.com/tildeio/rsvp.js) promise library which allows you to use the `catch(onRejected)` method instead of `then(undefined, onRejected)` for handling errors.

**singleton-process** methods also take callbacks, so we can accomplish roughly the same thing with the following:

```js
singleton.lock(function (err, success) {
    if (err) {
        // darn it! an error occurred during the lock
        
        // probably should log it
        ...
    } else {
        if (success) {
            // a lock was obtained!
            
            // protected code block to execute within lock
            ...
            
            // release the singleton lock when you're all done
            singleton.release(function (err) {
                if (err) {
                    // dang, an error occurred releasing the lock
                    
                    // probably should log it
                    ...
                } else {
                    // code to run when the lock is released (or was never obtained)
                    // usually just exit the process
                    ...    
                }
            });        
        } else {
            // a lock already exists!
            
            // maybe log something
            ...
        }
    }
});
```

When **singleton-process** obtains a lock, it registers an event handler with the `SIGTERM` event of the host process that automatically releases the lock should the process be singnaled for termination.  This can be important in situations like [PaaS](http://en.wikipedia.org/wiki/Platform_as_a_service) deployments where your Node.js processes aren't under your direct management.

To ensure that your singleton instance also releases its lock when an error occurs, favor the promises approach.  If you insist on using callbacks, you can try using a Node.js [domain](http://nodejs.org/api/domain.html):

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
    singleton.lock(function (err, success) {
        ...   
    });
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

* `lock([callback])`  
Attempts to obtain a lock for the named singleton instance.  Returns a promise with a `success` value which is `true` if the lock was obtained and `false` if a lock by the same name already exists.
**Arguments**:
    * `callback(err, success)` (optional): A callback to invoke when the lock attempt is complete.  
    **Arguments**:
        * `err`: An error occurred while performing the lock.
        * `success`: same meaning as the returned promise value
* `release([callback])`  
Attempts to release an existing singleton lock.  Returns an empty promise if the release was successful.  
**Arguments**:
    * `callback(err)` (optional): A callback to invoke when the lock release is complete.  
    **Arguments**:
        * `err`: An error occurred while releasing the lock.
* `exists([callback])`  
Determines if a named singleton instance currently exists.  Returns a promise with an `exists` value which is `true` if the lock exists; otherwise `false`.  
**Arguments**:
    * `callback(err, exists)` (optional): A callback to invoke when the exist check is complete.  
    **Arguments**:
        * `err`: An error occurred while performing the check.
        * `exists`: same meaning as the returned promise value

## Singleton Events

A `Singleton` instance also emits events!  They are optional to handle since the core workflow can be accomplished using the promises or callbacks as demonstrated in the [Usage](#usage) section.

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

* **MongoDB**: Created using the `singletonProcess.persisters.MongoDb` class (as shown in the [Usage](#usage) example above).

### Please feel free to fork the repo and add more!

A persister class should provide the following interface:

* `persistLock(name, callback)` method  
Atomically save a lock to the data store.  
**Arguments**:
    * `name`: The name of the lock to persist.
    * `callback(err, success, conflictCreated)`: A callback to invoke when persistence is complete.  
    **Arguments**:
        * `err`: An error object if an error occurs during persistence.
        * `success`: `true` if the lock was successfully persisted; `false` if an existing lock prevented the persistence.
        * `conflictCreated`: if the lock was not successful, the date that the existing lock was created or `null` if that can't be determined. 
* `deleteLock(name, callback)` method  
Atomically remove an existing lock.  
**Arguments**:
    * `name`: The name of the lock to delete.
    * `callback(err)`: A callback to invoke when the lock removal is complete.  
    **Arguments**:
        * `err`: An error object if an error occurs during lock removal.
* `lockExists(name, callback)` method  
Queries the data store to check for the existance of a lock.  
**Arguments**:
    * `name`: The name of the lock to check.
    * `callback(err, exists)`: A callback to invoke when the check is complete.  
    **Arguments**:
        * `err`: An error object if an error occurs during the check.
        * `exists`: `true` if the lock exists; otherwise `false`.
