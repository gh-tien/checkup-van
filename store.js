/* =========================================================================
   Fleet Spot-Check — data layer (store.js)

   Every read and write of *domain data* goes through this file. Screens never
   touch localStorage and never hold their own copies of a collection.

   Why: the app runs on localStorage today, but a backend replaces it later
   (PROGRESS.md, phase 2 decision: "route every read/write through a swappable
   data layer"). Swapping means writing one driver and calling
   Store.useDriver(d) — no screen code changes.

   Shape of the seam
   -----------------
     driver  : async, owns bytes. load() / save(db) / clear().
     Store   : sync, owns the in-memory database. Reads are synchronous so
               render() stays synchronous; writes update memory immediately,
               notify subscribers, then flush to the driver in the background.

   So a remote backend is "async underneath, sync on top". The one place that
   is genuinely async is start-up: await Store.ready() before first render.

   Load order: store.js BEFORE app.js. Exposes window.Store. No modules, no
   build step — same rules as the rest of the app.
   ========================================================================= */
'use strict';

var Store = (function () {

  /* ------------------------------------------------------------ shapes --- */
  /*
     Conventions used by every record:
       id          string, unique within its collection. Store.newId() makes them.
       *At         ISO 8601 timestamp, e.g. '2026-08-16T06:15:00.000Z'.
       *On / dates plain ISO date, 'YYYY-MM-DD'. No display strings in storage —
                   '13 Aug' is a formatting decision, made at render time.
       enums       lowercase strings, never array indexes. An index into a
                   module constant is not portable to a backend.
       money/nums  numbers, not strings. Mileage is a number.

     vans
       { id, reg, model, status, bay, motDue, lastCheckOn, retiredOn, createdAt }
         reg         'KX21 HVD'      — free text, uppercased on save
         model       'Ford Transit Custom' — free text (item 15)
         status      'active' | 'offroad' | 'retired'
         bay         'Bay 4' | ''    — free text
         motDue      'YYYY-MM-DD' | ''
         lastCheckOn 'YYYY-MM-DD' | ''  — denormalised from checks, for lists
         retiredOn   'YYYY-MM-DD' | ''

     people
       { id, name, role, active, pinSetOn, createdAt }
         role        'inspector' | 'manager'
         pinSetOn    'YYYY-MM-DD' | ''   ('' means never set)

     workshops                      — assignees a defect can be sent to
       { id, name, active, createdAt }

     checklist                      — the editable template (item 13).
       One record per section, order = array order.
       { id, name, retired, items: [ item ] }
       item
         { id, name, crit, hint, retired, added, type, unit, parts,
           limit, warn, dir }
         crit        boolean — a critical item fails the whole check
         type        'pf' (pass/fail) | 'm' (measured)
         unit        'mm' | 'kPa' | '%' | 'V' | 'L'      (type 'm' only)
         parts       0 single | 1 front&rear | 2 four corners
         limit,warn  numbers; dir 'below' | 'above' — which side fails

     checks                         — a completed or in-progress spot-check
       { id, vanId, reg, inspectorId, inspectorName, secondName,
         startedAt, finishedAt, mileage, results, passed, failed, photos,
         decision, decidedAt, decidedBy, returnNote, createdAt }
         results     [ { itemId, name, sectionName, crit, outcome, values, note } ]
           outcome   'pass' | 'fail' | 'na'
           values    [] for 'pf'; array of numbers for 'm', one per part
         decision    null | 'countersigned' | 'sent-back'
         mileage     number | null
         photos      { <shot label>: <photo id> } — walk-around shots. The IDS
                     live here; the image BYTES live in photos.js / IndexedDB,
                     keyed by these ids. Old checks predate the field, so every
                     reader must treat a missing `photos` as {}. Note: the ids
                     are device-local — a JSON backup (item 21) carries them but
                     NOT the blobs, so a restored depot shows the shots as empty.

     defects                        — raised off a failed check item
       { id, checkId, vanId, reg, name, severity, note, stage, safeToDrive,
         workshopId, raisedOn, dueOn, repairedOn, recheckedBy, closedOn,
         createdAt }
         severity    'minor' | 'major'
         stage       'awaiting' | 'verified' | 'closed'
                     "overdue" is NOT stored — it is dueOn < today on an
                     awaiting defect, so it can never go stale on disk.
         safeToDrive boolean | null
         repairedOn / recheckedBy — filled when the repair is re-checked

     settings                       — single key/value record, id 'settings'
       { id:'settings', depotName, checklistVersion, checklistPublishedOn,
         excludeDays, forceDays, targetPerWeek, rerolls }
         depotName   'Barking depot' | ''  — free text, what this depot is
                     called. '' means unnamed and the app says so rather than
                     guessing; there is exactly ONE depot per install, which is
                     why this is a setting and not a collection.
         the last four are the draw rules the Coverage screen reads and writes
  */

  var COLLECTIONS = ['vans', 'people', 'workshops', 'checklist', 'checks', 'defects'];

  var DEFAULT_SETTINGS = {
    id: 'settings',
    /* Empty, not 'Barking depot'. A depot that has not been named should say so
       once, in Settings, rather than carry somebody else's name around on every
       screen — which is exactly what the hardcoded title used to do. `migrate()`
       assigns DEFAULT_SETTINGS under the stored ones, so depots that predate
       this field pick up '' and get asked the question too. */
    depotName: '',
    checklistVersion: 1,
    checklistPublishedOn: '',
    excludeDays: 14,   // don't re-pick a van checked within N days
    forceDays: 90,     // force a van in if unchecked for N days
    targetPerWeek: 8,  // how many checks the depot aims to walk in a week
    rerolls: 1
  };

  /* ----------------------------------------------------------- drivers --- */
  /*
     A driver is three async methods. That is the whole contract:

       load()      -> Promise<db|null>   null means "nothing stored yet"
       save(db)    -> Promise<void>      whole-database write, last write wins
       clear()     -> Promise<void>

     Whole-database save is fine for a depot's worth of records and keeps the
     contract trivial. A REST/Supabase driver that wants per-record writes can
     diff `db` against its own last-seen copy inside save(); nothing above the
     driver needs to know.
  */

  var STORAGE_KEY = 'spotcheck.db.v1';

  var localDriver = {
    name: 'local',
    load: function () {
      return new Promise(function (res) {
        var raw = null;
        try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { /* private mode */ }
        if (!raw) return res(null);
        try { res(JSON.parse(raw)); } catch (_) { res(null); }   // corrupt -> first run
      });
    },
    save: function (db) {
      return new Promise(function (res, rej) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); res(); }
        catch (e) { rej(e); }                                    // quota / private mode
      });
    },
    clear: function () {
      return new Promise(function (res) {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        res();
      });
    }
  };

  /* Fallback when localStorage throws (Safari private browsing). The app still
     works for the session; nothing survives a reload. */
  var memoryDriver = function () {
    var held = null;
    return {
      name: 'memory',
      load: function () { return Promise.resolve(held); },
      save: function (db) { held = JSON.parse(JSON.stringify(db)); return Promise.resolve(); },
      clear: function () { held = null; return Promise.resolve(); }
    };
  };

  /* ------------------------------------------------------------- state --- */

  var driver = localDriver;
  var db = null;              // { schema, collections..., settings }
  var subs = [];
  var readyP = null;
  var flushTimer = null;
  var flushing = false;
  var dirty = false;
  var lastError = null;
  var seq = 0;

  var SCHEMA = 1;

  function emptyDb() {
    var d = { schema: SCHEMA, settings: assign({}, DEFAULT_SETTINGS) };
    COLLECTIONS.forEach(function (c) { d[c] = []; });
    return d;
  }

  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i];
      if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
    }
    return t;
  }

  var clone = function (v) { return v == null ? v : JSON.parse(JSON.stringify(v)); };

  /* Records handed out are copies. A screen that mutates what it got back can
     never desync the store from what was persisted. */
  function out(rec) { return clone(rec); }

  /* --------------------------------------------------------- migration --- */
  /*
     Every stored db carries `schema`. Add a step here when a shape changes;
     never edit an old step. Steps run in order until schema === SCHEMA.
  */
  var MIGRATIONS = {
    // 1: base shape. Example of the next one:
    // 2: function (d) { d.vans.forEach(function (v) { v.bay = v.bay || ''; }); }
  };

  function migrate(stored) {
    var d = assign(emptyDb(), stored);
    var from = typeof stored.schema === 'number' ? stored.schema : 1;
    while (from < SCHEMA) {
      var step = MIGRATIONS[from + 1];
      if (step) step(d);
      from += 1;
    }
    d.schema = SCHEMA;
    d.settings = assign({}, DEFAULT_SETTINGS, d.settings || {});
    /* `targetPerDay` was always read as a weekly target — 8 checks a day is
       not a thing a depot does. Carry the number over to the honest name and
       drop the old key, so there is only ever one of them on disk. */
    if (typeof d.settings.targetPerDay === 'number') {
      var hadNew = stored.settings && typeof stored.settings.targetPerWeek === 'number';
      if (!hadNew) d.settings.targetPerWeek = d.settings.targetPerDay;
      delete d.settings.targetPerDay;
    }
    COLLECTIONS.forEach(function (c) { if (!Array.isArray(d[c])) d[c] = []; });
    return d;
  }

  /* ------------------------------------------------------------ notify --- */

  function notify(change) {
    var snapshot = subs.slice();
    for (var i = 0; i < snapshot.length; i++) {
      try { snapshot[i](change); } catch (e) { console.error('[store] subscriber threw', e); }
    }
  }

  /* Writes land in memory now and on disk shortly after. Coalescing means a
     burst of edits (typing a reg, stepping a reading) is one write, and a
     remote driver later gets one request instead of twenty. */
  function touch(change) {
    dirty = true;
    schedule();
    notify(change || null);
  }

  function schedule() {
    if (flushTimer || flushing) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, 120);
  }

  function flush() {
    if (flushing || !dirty || !db) return Promise.resolve();
    flushing = true;
    dirty = false;
    var payload = clone(db);
    return driver.save(payload)
      .then(function () { lastError = null; })
      .catch(function (e) {
        lastError = e;
        dirty = true;                       // keep it pending, try again later
        console.error('[store] save failed on driver "' + driver.name + '"', e);
        if (driver === localDriver) {       // quota or private mode: don't lose the session
          driver = memoryDriver();
          console.warn('[store] fell back to the in-memory driver — this session will not persist');
        }
      })
      .then(function () {
        flushing = false;
        if (dirty) schedule();
      });
  }

  /* Best effort on the way out — backgrounding a PWA on a phone is the normal
     way this app closes, so pagehide matters more than beforeunload. */
  function bindLifecycle() {
    var out = function () { if (dirty && db) { try { driver.save(clone(db)); } catch (_) {} } };
    window.addEventListener('pagehide', out);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') out();
    });
  }

  /* --------------------------------------------------------------- api --- */

  function requireDb() {
    if (!db) throw new Error('Store used before init() — await Store.ready() first');
    return db;
  }

  function list(name) {
    var d = requireDb();
    if (!Object.prototype.hasOwnProperty.call(d, name) || !Array.isArray(d[name]))
      throw new Error('Unknown collection "' + name + '"');
    return d[name];
  }

  var Store = {

    SCHEMA: SCHEMA,
    COLLECTIONS: COLLECTIONS.slice(),
    STORAGE_KEY: STORAGE_KEY,

    /* -- lifecycle -- */

    /* init({ seed }) — load, migrate, and on a genuinely empty database apply
       `seed`. seed is either an object of collections or a function returning
       one; it runs ONCE, on first run only, so it is starting configuration
       (the checklist template), not fixtures that reappear after a wipe. */
    init: function (opts) {
      if (readyP) return readyP;
      opts = opts || {};
      bindLifecycle();
      readyP = driver.load()
        .catch(function (e) { console.error('[store] load failed', e); return null; })
        .then(function (stored) {
          var firstRun = !stored;
          db = stored ? migrate(stored) : emptyDb();
          if (firstRun && opts.seed) {
            var seed = typeof opts.seed === 'function' ? opts.seed() : opts.seed;
            Object.keys(seed || {}).forEach(function (k) {
              if (k === 'settings') { db.settings = assign({}, db.settings, clone(seed[k])); return; }
              if (Array.isArray(db[k])) db[k] = clone(seed[k]) || [];
            });
            dirty = true;
            schedule();
          }
          return Store;
        });
      return readyP;
    },

    ready: function () { return readyP || Store.init(); },

    /* Swap the backend. Pass { adopt:true } to push what is in memory into the
       new driver (local -> remote first sync); otherwise the new driver's data
       wins and the app is told to re-render. */
    useDriver: function (d, opts) {
      if (!d || typeof d.load !== 'function' || typeof d.save !== 'function')
        throw new Error('A driver needs load(), save(db) and clear()');
      driver = d;
      opts = opts || {};
      if (opts.adopt) { dirty = true; return flush().then(function () { return Store; }); }
      return driver.load().then(function (stored) {
        db = stored ? migrate(stored) : emptyDb();
        notify(null);
        return Store;
      });
    },

    driverName: function () { return driver.name || 'custom'; },
    lastError: function () { return lastError; },
    flush: function () { return flush(); },

    /* -- reads (synchronous) -- */

    all: function (name) { return list(name).map(out); },

    find: function (name, fn) {
      var hit = list(name).filter(fn)[0];
      return hit ? out(hit) : null;
    },

    where: function (name, fn) { return list(name).filter(fn).map(out); },

    get: function (name, id) {
      var hit = list(name).filter(function (r) { return r.id === id; })[0];
      return hit ? out(hit) : null;
    },

    count: function (name, fn) {
      return fn ? list(name).filter(fn).length : list(name).length;
    },

    settings: function () { return clone(requireDb().settings); },

    /* -- writes -- */

    insert: function (name, rec) {
      var arr = list(name);
      var row = assign({}, clone(rec) || {});
      if (!row.id) row.id = Store.newId(name);
      if (!row.createdAt) row.createdAt = new Date().toISOString();
      arr.push(row);
      touch({ collection: name, op: 'insert', id: row.id });
      return out(row);
    },

    update: function (name, id, patch) {
      var arr = list(name);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id !== id) continue;
        arr[i] = assign({}, arr[i], clone(patch) || {}, { id: id });
        touch({ collection: name, op: 'update', id: id });
        return out(arr[i]);
      }
      return null;
    },

    upsert: function (name, rec) {
      return Store.get(name, rec && rec.id) ? Store.update(name, rec.id, rec) : Store.insert(name, rec);
    },

    remove: function (name, id) {
      var arr = list(name);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id !== id) continue;
        arr.splice(i, 1);
        touch({ collection: name, op: 'remove', id: id });
        return true;
      }
      return false;
    },

    /* Whole-collection write. Used where the screen edits an ordered structure
       in one go — the checklist editor rewrites sections and items together. */
    replace: function (name, rows) {
      var d = requireDb();
      list(name);
      d[name] = clone(rows) || [];
      touch({ collection: name, op: 'replace', id: null });
      return Store.all(name);
    },

    /* Reorder / edit in place with an array you are free to mutate. */
    mutate: function (name, fn) {
      var next = Store.all(name);
      var ret = fn(next);
      return Store.replace(name, Array.isArray(ret) ? ret : next);
    },

    setSettings: function (patch) {
      var d = requireDb();
      d.settings = assign({}, d.settings, clone(patch) || {}, { id: 'settings' });
      touch({ collection: 'settings', op: 'update', id: 'settings' });
      return clone(d.settings);
    },

    /* -- subscriptions -- */

    /* subscribe(fn) -> unsubscribe. fn gets {collection, op, id} or null for a
       wholesale change (driver swap, import, reset). app.js re-renders on it. */
    subscribe: function (fn) {
      subs.push(fn);
      return function () { subs = subs.filter(function (s) { return s !== fn; }); };
    },

    /* -- whole-database operations -- */

    snapshot: function () { return clone(requireDb()); },

    /* Backup / restore, and the honest way to move a depot's data between
       devices while there is no backend. */
    export: function () { return JSON.stringify(Store.snapshot(), null, 2); },

    import: function (json) {
      var parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (!parsed || typeof parsed !== 'object') throw new Error('Not a Spot-Check backup');
      db = migrate(parsed);
      touch(null);
      return Store;
    },

    /* Wipe everything, including the seed. init()'s seed does not come back —
       call reset({ seed }) to put the starting configuration back. */
    reset: function (opts) {
      opts = opts || {};
      db = emptyDb();
      if (opts.seed) {
        var seed = typeof opts.seed === 'function' ? opts.seed() : opts.seed;
        Object.keys(seed || {}).forEach(function (k) {
          if (k === 'settings') { db.settings = assign({}, db.settings, clone(seed[k])); return; }
          if (Array.isArray(db[k])) db[k] = clone(seed[k]) || [];
        });
      }
      touch(null);
      return driver.clear().then(function () { dirty = true; return flush(); }).then(function () { return Store; });
    },

    /* -- ids -- */

    /* Prefixed so a record's origin is readable in a console or an export.
       crypto.randomUUID where available, counter + time otherwise; both are
       unique enough for one depot and stable against clock skew. */
    newId: function (name) {
      var prefix = (name || 'r').slice(0, 3);
      var body;
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        body = window.crypto.randomUUID().slice(0, 8);
      } else {
        seq += 1;
        body = Date.now().toString(36) + seq.toString(36);
      }
      return prefix + '_' + body;
    },

    /* -- dates -- */
    /* One place that decides what "today" means, so records never disagree.
       Local date parts, not toISOString() — a depot east of UTC would
       otherwise date the morning's checks as yesterday. */
    today: function () {
      var d = new Date();
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    },
    now: function () { return new Date().toISOString(); },

    /* -- drivers, for later -- */
    drivers: { local: localDriver, memory: memoryDriver }
  };

  return Store;
})();

if (typeof window !== 'undefined') window.Store = Store;
