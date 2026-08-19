/* =========================================================================
   Fleet Spot-Check — photo blobs (photos.js)

   The SECOND storage layer, and a deliberate one (PROGRESS.md, phase-3
   decision). A phone photo is 2-4MB and localStorage is ~5MB of STRINGS per
   origin — one photo would fill it. So the depot's records live in localStorage
   via store.js, and the *images* live here in IndexedDB, which stores Blobs
   natively and has room for them.

   The seam between the two: a check record (in store.js) holds only photo IDS
   — short strings — under `check.photos = { FRONT: 'pho_…', … }`. The bytes for
   those ids live here. Neither layer holds the other's data.

   Contract (all async, all id-keyed):
     Photos.put(blob)      -> Promise<id>     store bytes, get an id back
     Photos.get(id)        -> Promise<Blob|null>
     Photos.remove(id)     -> Promise<void>
     Photos.removeMany([]) -> Promise<void>
     Photos.keys()         -> Promise<[id]>
     Photos.gc(keepIds)    -> Promise<void>    drop every blob not in keepIds

   Load order: photos.js AFTER store.js, BEFORE app.js. Exposes window.Photos.
   No modules, no build step — same rules as the rest of the app.

   If IndexedDB is missing (old browser) or refused (Safari private mode), it
   falls back to an in-memory map: photos work for the session and are gone on
   reload, exactly as store.js's memory driver does for records.
   ========================================================================= */
'use strict';

var Photos = (function () {

  var DB_NAME = 'spotcheck.photos';
  var STORE = 'blobs';
  var DB_VERSION = 1;

  var dbP = null;         // Promise<IDBDatabase>, opened once
  var mem = null;         // Map fallback, created only if IndexedDB fails
  var seq = 0;

  function newId() {
    var body;
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      body = window.crypto.randomUUID().slice(0, 12);
    } else {
      seq += 1;
      body = Date.now().toString(36) + seq.toString(36);
    }
    return 'pho_' + body;
  }

  /* Open (or fall back). A rejected open flips us to the in-memory map for the
     rest of the session; every method below checks `mem` first. */
  function open() {
    if (mem) return Promise.reject(new Error('memory mode'));
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no indexeddb'));
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { return rej(e); }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error || new Error('indexeddb open failed')); };
      req.onblocked = function () { rej(new Error('indexeddb blocked')); };
    }).catch(function (e) {
      console.warn('[photos] no IndexedDB — photos held in memory for this session only', e);
      mem = mem || {};
      throw e;
    });
    return dbP;
  }

  /* Run one transaction and resolve with the request's result. */
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var req = fn(store);
        t.oncomplete = function () { res(req && req.result); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error || new Error('transaction aborted')); };
      });
    });
  }

  return {
    put: function (blob) {
      var id = newId();
      return tx('readwrite', function (s) { return s.put(blob, id); })
        .then(function () { return id; })
        .catch(function () { mem = mem || {}; mem[id] = blob; return id; });
    },

    get: function (id) {
      if (!id) return Promise.resolve(null);
      return tx('readonly', function (s) { return s.get(id); })
        .then(function (v) { return v || null; })
        .catch(function () { return (mem && mem[id]) || null; });
    },

    remove: function (id) {
      if (!id) return Promise.resolve();
      return tx('readwrite', function (s) { return s.delete(id); })
        .catch(function () { if (mem) delete mem[id]; });
    },

    removeMany: function (ids) {
      if (!ids || !ids.length) return Promise.resolve();
      return tx('readwrite', function (s) { ids.forEach(function (id) { if (id) s.delete(id); }); })
        .catch(function () { if (mem) ids.forEach(function (id) { delete mem[id]; }); });
    },

    keys: function () {
      return tx('readonly', function (s) { return s.getAllKeys(); })
        .then(function (ks) { return ks || []; })
        .catch(function () { return mem ? Object.keys(mem) : []; });
    },

    /* Drop every blob whose id is not still referenced. Called after boot so a
       discarded walk or a failed write can't leave images piling up forever —
       the records are the source of truth, the blobs follow them. */
    gc: function (keepIds) {
      var keep = {};
      (keepIds || []).forEach(function (id) { if (id) keep[id] = true; });
      return this.keys().then(function (ks) {
        var orphans = ks.filter(function (id) { return !keep[id]; });
        return orphans.length ? Photos.removeMany(orphans) : undefined;
      }).catch(function () { /* best effort */ });
    }
  };
})();

if (typeof window !== 'undefined') window.Photos = Photos;
