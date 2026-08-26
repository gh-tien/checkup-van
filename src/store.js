import React, { createContext, useContext, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PEOPLE, CHECKLIST, CORRECT_PIN, initials, seedPeople, seedCapGroups,
  genVans, seedQueue, seedApproved, checklistModel,
} from './data/model';
import { TODAY, daysUntil } from './format';
import { C } from './theme';

// Fleet status metadata (label + role colours), ported from the prototype's stMeta.
export const STATUS = {
  blocked: { label: 'Attention', c: C.danger, bg: C.dangerBg },
  jobs: { label: 'Open defects', c: C.amber, bg: C.amberBg },
  overdue: { label: 'Overdue', c: C.slate, bg: C.border2 },
  spare: { label: 'Spare', c: C.slate, bg: C.chipBlue },
  ok: { label: 'OK', c: C.green, bg: C.greenBg },
};

const STORE_KEY = 'spotcheck:v2';
// A native app has no downloads folder, so "save a backup" writes a second slot in
// device storage instead of a file. See DECISIONS.md.
const BACKUP_KEY = 'spotcheck:backup:v2';
// State that survives a reload. Transient UI (gate/draw/check) is not persisted.
const PERSIST_KEYS = ['depotName', 'excludeDays', 'forceDays', 'rerolls', 'target',
  'fleet', 'people', 'queue', 'approved', 'returned', 'photoAngles', 'clVersion',
  'configGroups', 'capOff', 'docTypes', 'vehicleUses',
  'depotAddr', 'geofenceRadius', 'locationGate', 'deviceBinding', 'accessCode'];

const DEFAULT_ANGLES = ['Front', 'Rear', 'Nearside', 'Offside', 'Dashboard / odometer', 'Interior / load area'];
const DEFAULT_RULES = { excludeDays: '7', forceDays: '30', rerolls: '2', target: '12' };
// Document types a depot files against a vehicle: a name and how many files that type expects.
// Configurable in Config — a depot adds its own on top of these.
const DEFAULT_DOC_TYPES = [
  { name: 'Roadworthy', files: 1 },
  { name: 'Registration', files: 1 },
  { name: 'CTP', files: 1 },
  { name: 'Insurance', files: 1 },
];
// What a vehicle is used for. Starts with these; a depot adds its own in Config.
const DEFAULT_USES = ['PRV', 'BUS'];
const capKey = (role, name) => role + '\u0000' + name;

let uid = 0;
const nextId = (p) => p + Date.now().toString(36) + '-' + (uid++);

class Store {
  constructor() {
    const fleet = genVans();
    this.state = {
      // --- session / gate ---
      signedOut: true,
      lockReason: '',
      gatePhase: 'pick',        // 'pick' | 'pin'
      pinPerson: '',
      pinEntry: '',
      pinError: false,
      activePerson: null,
      pickQuery: '',
      // --- navigation ---
      screen: 'checkhome',      // checkhome | faults | vans | van | approved | more | check
                                // | settings | config | people | profile | help
      toast: '',
      // --- fleet list ---
      fleetFilter: 'all',       // all | overdue | jobs | blocked
      fleetQuery: '',
      // --- vehicle detail ---
      vanId: null,
      timelineOpen: '',
      vanLogOpen: false,
      docSheetOpen: false, docSheetVan: '', docEditIdx: null,
      docName: '', docDate: '', docNote: '', docFiles: [],
      detailSheetOpen: false, detailVan: '',
      edYear: '', edFuel: '', edService: '', edVin: '',
      edColor: '', edGvm: '', edTare: '', edUse: '',
      // --- defects ---
      faultsQuery: '',
      faultOpen: {},
      // --- approvals ---
      approvedPeriod: 'week',   // week | month
      queueSubOpen: '',
      sendBackFor: null,
      sendBackNote: '',
      // --- depot config ---
      depotName: 'Chullora CPDC',
      // Depot & access (Config → top card)
      depotAddr: '88 Rookwood Rd, Chullora NSW 2190',
      geofenceRadius: '150', locationGate: true, deviceBinding: true, accessCode: '4Q7-2K9',
      depotOpen: true,          // Depot & access accordion (open on load)
      ...DEFAULT_RULES,
      configGroups: seedCapGroups(),
      capOff: {},               // { 'Role Cap name': true } — switched-off capabilities
      docTypes: [...DEFAULT_DOC_TYPES],
      docTypeNew: '', docTypeFiles: '1',  // draft for the add-a-doc-type row
      vehicleUses: [...DEFAULT_USES],
      useNew: '',                         // draft for the add-a-use row
      groupOpen: '',            // which role accordion is expanded
      // Config section accordions — closed on load, like the prototype.
      drawRulesOpen: false, photosOpen: false, docTypesOpen: false, usesOpen: false, rolesOpen: false,
      showAddValue: false,      // hidden edit mode (long-press / triple-tap the Config header)
      angleNew: '',
      capNew: {},               // { role: draft text }
      capEdit: null,            // { role, idx, text }
      // --- settings / backup / reset ---
      backupMeta: null,         // { savedAt, vans, checks, defects }
      restoreOpen: false,
      resetModal: false,
      resetReason: '',
      // --- people ---
      peopleFilter: 'all',      // all | Manager | Inspector
      peopleSheet: null,        // { mode: 'add' | 'manage', name }
      peopleNew: '',
      peopleNewRole: 'Inspector',
      // --- profile ---
      viewPerson: null,
      draftRole: null,
      profRoleOpen: false,
      profCapsOpen: false,
      // --- help ---
      helpOpen: '',
      // --- fleet / people / records ---
      fleet,
      people: seedPeople(),
      queue: seedQueue(fleet),
      approved: seedApproved(fleet),
      returned: [],
      clVersion: CHECKLIST.version,
      // --- draw ---
      drawOpen: false,
      drawSettled: false,
      drawPlate: null,
      drawSpinPlate: '',
      drawMode: '',
      drawRerolls: 0,
      // --- check flow ---
      checkStep: 'driver',      // driver | photos | list | review | done
      // Driver confirm is a launch bottom sheet over the Dashboard/Fleet by default; the
      // full-screen 'driver' wizard step is kept as the alternate ('fullscreen') for comparison.
      driverLaunch: 'sheet',    // sheet | fullscreen
      driverSheet: null,        // plate while the launch sheet is open
      checkOrigin: null,        // 'draw' | 'van' | 'returned' — where the check was launched from,
                                // so a "not in use" skip knows whether to draw another vehicle
      checkVan: null,
      checkResults: {},
      checkDefects: {},
      failSheet: null,
      checkSigned: false,
      checkDriver: '',
      checkNoKeyholder: false,
      checkPhotoMap: {},        // { [angle]: [fileUri, ...] }
      checkOdo: '',
      camera: null,             // { mode: 'angle' | 'defect', angle }
      photoAngles: [...DEFAULT_ANGLES],
    };
    this._subs = new Set();
    this._spin = null;
    this._toastT = null;
    this._hydrated = false;
    this._hold = null;
    this._tapTimer = null;
    this._taps = 0;
  }

  // ---- external-store plumbing ----
  subscribe = (fn) => { this._subs.add(fn); return () => this._subs.delete(fn); };
  getSnapshot = () => this.state;
  setState(patch, cb) {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...next };
    this._subs.forEach((fn) => fn());
    if (cb) cb();
  }

  // ---- persistence ----
  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const patch = {};
        PERSIST_KEYS.forEach((k) => { if (saved[k] !== undefined) patch[k] = saved[k]; });
        this.setState(patch);
      }
    } catch (e) { /* ignore corrupt store */ }
    try {
      const raw = await AsyncStorage.getItem(BACKUP_KEY);
      if (raw) {
        const b = JSON.parse(raw);
        if (b && b.data) this.setState({ backupMeta: this.metaOf(b) });
      }
    } catch (e) { /* no backup yet */ }
    this._hydrated = true;
  }
  saveState() {
    if (!this._hydrated) return;
    const snap = {};
    PERSIST_KEYS.forEach((k) => { snap[k] = this.state[k]; });
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(snap)).catch(() => {});
  }

  // ---- helpers ----
  say(msg) {
    this.setState({ toast: msg });
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.setState({ toast: '' }), 2200);
  }
  resolvedPerson() { return this.state.activePerson || 'Phuog Lam'; }
  roleOf(name) {
    const p = this.state.people.find((x) => x.name === name);
    return (p && p.role) || (PEOPLE[name] || {}).role || 'Inspector';
  }
  personRole() { return this.roleOf(this.resolvedPerson()); }
  isManager() { return ['Manager', 'Manager+', 'Admin'].includes(this.personRole()); }
  isAdmin() { return this.personRole() === 'Admin'; }
  clModel() { return checklistModel(); }
  liveItems() { return this.clModel().flatMap((s) => s.items); }

  // ---- fleet status ----
  hasJobs(v) { return !!(v.jobs && v.jobs.length); }
  // A spare / not-in-use vehicle is not driven, so it never reads as due — it drops out of the
  // "to check" counts, the Fleet overdue filter and the draw pool until it's put back in service.
  isOverdue(v) { return !v.spare && (v.last == null || v.last >= 30); }
  statOf(v) { return v.blocked ? 'blocked' : v.spare ? 'spare' : this.hasJobs(v) ? 'jobs' : this.isOverdue(v) ? 'overdue' : 'ok'; }
  vanById(plate) { return this.state.fleet.find((v) => v.plate === plate) || null; }

  // ---- gate ----
  openGate() { this.setState({ signedOut: true, gatePhase: 'pick', pinEntry: '', pinError: false, pinPerson: '', pickQuery: '' }); }
  onPickQuery(q) { this.setState({ pickQuery: q }); }
  clearPickQuery() { this.setState({ pickQuery: '' }); }
  choosePerson(name) {
    const p = this.state.people.find((x) => x.name === name);
    if (p && p.suspended) return this.say(name + ' is suspended — ask an admin.');
    this.setState({ gatePhase: 'pin', pinPerson: name, pinEntry: '', pinError: false });
  }
  pad(d) {
    if (this.state.pinEntry.length >= 4) return;
    const entry = this.state.pinEntry + d;
    if (entry.length === 4) {
      if (entry === CORRECT_PIN) { this.enter(this.state.pinPerson); }
      else { this.setState({ pinEntry: '', pinError: true }); }
    } else {
      this.setState({ pinEntry: entry, pinError: false });
    }
  }
  padBack() { this.setState((s) => ({ pinEntry: s.pinEntry.slice(0, -1), pinError: false })); }
  enter(name) {
    this.setState({ signedOut: false, activePerson: name, gatePhase: 'pick', pinEntry: '', pinError: false, lockReason: '', screen: 'checkhome' });
  }
  devSkip() { this.enter(this.state.pinPerson || 'Phuog Lam'); }
  goAdmin() { this.enter('System Admin'); }
  signOut(reason) {
    clearInterval(this._spin);
    this.setState({ signedOut: true, gatePhase: 'pick', pinEntry: '', pinPerson: '', pickQuery: '',
      lockReason: reason || '', drawOpen: false, screen: 'checkhome', checkVan: null });
  }

  // ---- navigation ----
  go(screen) { this.setState({ screen }); }
  goVans(filter) { this.setState({ screen: 'vans', fleetFilter: filter || 'all' }); }
  goVan(plate) { this.setState({ screen: 'van', vanId: plate, timelineOpen: '', vanLogOpen: false }); }

  // One place that decides what "back" means, shared by the header chevron and Android's
  // hardware Back — so the two never disagree. Inside a check it steps the wizard back one
  // stage (and, at the first stage, leaves to the fleet) rather than dropping the walk.
  navBack() {
    const st = this.state;
    if (st.screen === 'check') {
      if (st.checkStep === 'done') return this.finishCheck();
      // In sheet mode the driver gate isn't a wizard step, so photos is the first stage and
      // Back from it leaves the check. In fullscreen mode driver leads the wizard.
      const order = st.driverLaunch === 'sheet' ? ['photos', 'list', 'review'] : ['driver', 'photos', 'list', 'review'];
      const i = order.indexOf(st.checkStep);
      if (i > 0) return this.setState({ checkStep: order[i - 1] });
      return this.setState({ screen: 'vans', checkVan: null });
    }
    const parent = { van: 'vans', settings: 'more', config: 'settings', people: 'more', profile: 'people', help: 'more' };
    if (parent[st.screen]) return this.go(parent[st.screen]);
    if (st.screen !== 'checkhome') return this.go('checkhome');
  }

  // Android hardware/gesture Back. Dismisses any open overlay first, then delegates to
  // navBack(). Returns true when handled; false only at the Dashboard root, so the OS
  // backgrounds the app instead of Back doing nothing.
  hardwareBack() {
    const st = this.state;
    if (st.signedOut) return false;
    if (st.camera) { this.closeCamera(); return true; }
    if (st.failSheet) { this.cancelFail(); return true; }
    if (st.resetModal) { this.closeResetModal(); return true; }
    if (st.drawOpen) { this.closeDraw(); return true; }
    if (st.driverSheet) { this.closeDriverSheet(); return true; }
    if (st.screen === 'checkhome') return false;
    this.navBack();
    return true;
  }
  openRecord(plate) {
    if (this.vanById(plate)) this.goVan(plate);
    else this.say(plate + ' — approved record; vehicle isn’t in this snapshot.');
  }

  // ---- fleet list ----
  setFleetFilter(f) { this.setState({ fleetFilter: f }); }
  onFleetQuery(q) { this.setState({ fleetQuery: q }); }
  clearFleetQuery() { this.setState({ fleetQuery: '' }); }

  // ---- vehicle detail ----
  toggleTimeline(id) { this.setState((s) => ({ timelineOpen: s.timelineOpen === id ? '' : id })); }
  toggleVanLog() { this.setState((s) => ({ vanLogOpen: !s.vanLogOpen })); }
  markFixed(plate, jobText) {
    let cleared = false;
    this.setState((s) => ({
      fleet: s.fleet.map((v) => {
        if (v.plate !== plate) return v;
        const idx = v.jobs.indexOf(jobText);
        if (idx < 0) return v;
        cleared = true;
        const who = this.resolvedPerson();
        return {
          ...v,
          jobs: v.jobs.filter((j, i) => i !== idx),
          history: [{ date: TODAY, by: who, result: 'Defect cleared', photos: 0 }, ...(v.history || [])],
          log: [{ when: TODAY, who, what: 'Defect cleared — ' + jobText, kind: 'fix' }, ...(v.log || [])],
        };
      }),
    }), () => { this.saveState(); if (cleared) this.say('Marked fixed — ' + jobText); });
  }

  // Retire a vehicle from the depot. Drops its fleet record plus any actionable pending items
  // (queue awaiting review, returned-for-redo) so nothing orphaned points back at a plate that no
  // longer exists. Approved history is kept — it's the audit trail of checks that really happened.
  removeVan(plate) {
    const v = this.vanById(plate);
    if (!v) return;
    this.setState((s) => ({
      fleet: s.fleet.filter((x) => x.plate !== plate),
      queue: s.queue.filter((q) => q.plate !== plate),
      returned: s.returned.filter((r) => r.plate !== plate),
    }), () => { this.saveState(); this.goVans('all'); this.say(plate + ' removed from the fleet.'); });
  }

  // ---- documents ----
  openDocSheet(plate) {
    this.setState({ docSheetOpen: true, docSheetVan: plate, docEditIdx: null, docName: '', docDate: '', docNote: '', docFiles: [] });
  }
  openDocEdit(plate, idx) {
    const v = this.vanById(plate); const d = v && v.docs[idx];
    if (!d) return;
    this.setState({ docSheetOpen: true, docSheetVan: plate, docEditIdx: idx, docName: d.name || '', docDate: d.date || '', docNote: d.note || '', docFiles: Array.isArray(d.files) ? d.files : [] });
  }
  closeDocSheet() { this.setState({ docSheetOpen: false, docEditIdx: null }); }
  setDoc(patch) { this.setState(patch); }
  // How many files a named document type expects. 0 when the name isn't a
  // configured type (free-typed names aren't gated).
  docTypeFilesFor(name) {
    const t = this.state.docTypes.find((d) => d.name.toLowerCase() === String(name || '').trim().toLowerCase());
    return t ? t.files : 0;
  }
  // Attach a photo to the document being added/edited (camera mode 'doc').
  captureDocPhoto() { this.setState({ camera: { mode: 'doc', angle: null } }); }
  removeDocFile(uri) { this.setState((s) => ({ docFiles: s.docFiles.filter((u) => u !== uri) })); }
  saveDoc(plate) {
    const name = (this.state.docName || '').trim();
    if (!name) return this.say('Name the document first.');
    const required = this.docTypeFilesFor(name);
    const files = [...this.state.docFiles];
    if (files.length < required) {
      return this.say(name + ' needs ' + required + (required === 1 ? ' file' : ' files') + ' — ' + files.length + ' attached.');
    }
    const date = (this.state.docDate || '').trim();
    const note = (this.state.docNote || '').trim();
    const dd = daysUntil(date);
    const doc = { name, date, note, files, dueDays: dd, soon: dd !== null && dd >= 0 && dd <= 30, expired: dd !== null && dd < 0 };
    const idx = this.state.docEditIdx;
    const who = this.resolvedPerson();
    this.setState((s) => ({
      fleet: s.fleet.map((v) => {
        if (v.plate !== plate) return v;
        const docs = idx === null ? [...v.docs, doc] : v.docs.map((d, i) => (i === idx ? doc : d));
        const what = (idx === null ? 'Document added — ' : 'Document updated — ') + name;
        return { ...v, docs, log: [{ when: TODAY, who, what, kind: 'doc' }, ...(v.log || [])] };
      }),
      docSheetOpen: false, docEditIdx: null,
    }), () => { this.saveState(); this.say(idx === null ? 'Document added.' : 'Document saved.'); });
  }
  removeDoc(plate) {
    const idx = this.state.docEditIdx;
    if (idx === null) return;
    const who = this.resolvedPerson();
    this.setState((s) => ({
      fleet: s.fleet.map((v) => {
        if (v.plate !== plate) return v;
        const gone = v.docs[idx];
        return {
          ...v,
          docs: v.docs.filter((d, i) => i !== idx),
          log: [{ when: TODAY, who, what: 'Document removed — ' + ((gone && gone.name) || 'document'), kind: 'doc' }, ...(v.log || [])],
        };
      }),
      docSheetOpen: false, docEditIdx: null,
    }), () => { this.saveState(); this.say('Document removed.'); });
  }

  // ---- vehicle details ----
  openDetailEdit(plate) {
    const v = this.vanById(plate);
    if (!v) return;
    this.setState({
      detailSheetOpen: true, detailVan: plate,
      edYear: String(v.year || ''), edFuel: v.fuel || '', edService: v.inservice || '', edVin: v.vin || '',
      edColor: v.color || '', edGvm: v.gvm != null ? String(v.gvm) : '',
      edTare: v.tare != null ? String(v.tare) : '', edUse: v.use || '',
    });
  }
  closeDetailSheet() { this.setState({ detailSheetOpen: false }); }
  setDetail(patch) { this.setState(patch); }
  saveDetails(plate) {
    const year = (this.state.edYear || '').trim();
    const fuel = (this.state.edFuel || '').trim();
    const inservice = (this.state.edService || '').trim();
    const vin = (this.state.edVin || '').trim().toUpperCase();
    const color = (this.state.edColor || '').trim();
    const gvm = (this.state.edGvm || '').replace(/[^0-9]/g, '');
    const tare = (this.state.edTare || '').replace(/[^0-9]/g, '');
    const use = (this.state.edUse || '').trim();
    const who = this.resolvedPerson();
    this.setState((s) => ({
      fleet: s.fleet.map((v) => (v.plate !== plate ? v : {
        ...v, year, fuel, inservice, vin, color, gvm, tare, use,
        log: [{ when: TODAY, who, what: 'Vehicle details updated', kind: 'note' }, ...(v.log || [])],
      })),
      detailSheetOpen: false,
    }), () => { this.saveState(); this.say('Details saved.'); });
  }

  // ---- defects ----
  onFaultsQuery(q) { this.setState({ faultsQuery: q }); }
  clearFaultsQuery() { this.setState({ faultsQuery: '' }); }
  toggleFault(plate) { this.setState((s) => ({ faultOpen: { ...s.faultOpen, [plate]: !s.faultOpen[plate] } })); }

  // ---- approvals ----
  // The Approvals badge must count only what the signed-in person can actually do. A manager
  // acts on submissions that are not their own (another manager signs those); an inspector can
  // only redo their own returned walks — the awaiting queue is not theirs to touch.
  approvalsCount() {
    const me = this.resolvedPerson();
    if (this.isManager()) return this.state.queue.filter((q) => q.by !== me).length;
    return this.state.returned.filter((r) => r.by === me).length;
  }
  setApprovedPeriod(p) { this.setState({ approvedPeriod: p }); }
  toggleQueueSub(id) { this.setState((s) => ({ queueSubOpen: s.queueSubOpen === id ? '' : id })); }
  approveCheck(id) {
    const signer = this.resolvedPerson();
    const item = this.state.queue.find((q) => q.id === id);
    if (!item) return;
    if (item.by === signer) return this.say("You can't approve your own full inspection.");
    this.setState((s) => ({
      fleet: s.fleet.map((v) => (v.plate === item.plate
        ? { ...v, log: [{ when: TODAY, who: signer, what: 'Approved — full inspection by ' + item.by, kind: 'check' }, ...(v.log || [])] }
        : v)),
      queue: s.queue.filter((q) => q.id !== id),
      approved: [{ id: nextId('a'), plate: item.plate, by: item.by, date: item.date, result: item.result, defects: item.defects, signedBy: signer, week: true }, ...s.approved],
      queueSubOpen: '',
    }), () => { this.saveState(); this.say('Approved — moved to Approvals.'); });
  }
  openSendBack(id) { this.setState({ sendBackFor: id, sendBackNote: '' }); }
  closeSendBack() { this.setState({ sendBackFor: null, sendBackNote: '' }); }
  onSendBackNote(v) { this.setState({ sendBackNote: v }); }
  confirmSendBack() {
    const id = this.state.sendBackFor;
    if (!id) return;
    const note = (this.state.sendBackNote || '').trim();
    if (!note) return this.say('Add a reason before sending back.');
    const by = this.resolvedPerson();
    this.setState((s) => {
      const item = s.queue.find((q) => q.id === id);
      return {
        queue: s.queue.filter((q) => q.id !== id),
        returned: item ? [{ ...item, reason: note, returnedBy: by, returnedDate: TODAY }, ...s.returned] : s.returned,
        sendBackFor: null, sendBackNote: '', queueSubOpen: '',
      };
    }, () => { this.saveState(); this.say('Sent back to the inspector.'); });
  }
  redoReturned(id) {
    const item = this.state.returned.find((r) => r.id === id);
    if (!item) return;
    this.setState((s) => ({ returned: s.returned.filter((r) => r.id !== id) }), () => this.saveState());
    this.startCheck(item.plate);
  }
  dismissReturned(id) {
    this.setState((s) => ({ returned: s.returned.filter((r) => r.id !== id) }), () => { this.saveState(); this.say('Returned item cleared.'); });
  }

  // ---- draw ----
  drawPool() {
    const s = this.state;
    const exclude = parseInt(s.excludeDays, 10) || 0;
    const force = parseInt(s.forceDays, 10) || 99999;
    const lastOf = (v) => (v.last == null ? 99999 : v.last);
    const base = s.fleet.filter((v) => !v.blocked && !v.spare);
    if (!base.length) return { pool: [], mode: 'empty' };
    const forced = base.filter((v) => lastOf(v) >= force);
    if (forced.length) return { pool: forced, mode: 'forced' };
    const eligible = base.filter((v) => lastOf(v) >= exclude);
    if (eligible.length) return { pool: eligible, mode: 'eligible' };
    return { pool: base, mode: 'all' };
  }
  drawCheck(isReroll) {
    const limit = parseInt(this.state.rerolls, 10);
    const cap = isNaN(limit) ? 0 : limit;
    if (isReroll) {
      const used = this.state.drawRerolls || 0;
      if (used >= cap) return this.say(cap === 0 ? 'No re-rolls allowed — change it in Config.' : 'No re-rolls left (' + cap + ' per check).');
    }
    const { pool, mode } = this.drawPool();
    if (!pool.length) return this.say('Every vehicle needs attention or is excluded right now.');
    clearInterval(this._spin);
    this.setState({ drawOpen: true, drawSettled: false, drawPlate: null, drawMode: mode,
      drawRerolls: isReroll ? (this.state.drawRerolls || 0) + 1 : 0 });
    let n = 0;
    this._spin = setInterval(() => {
      const p = pool[Math.floor(Math.random() * pool.length)];
      this.setState({ drawSpinPlate: p.plate });
      if (++n > 20) {
        clearInterval(this._spin);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        this.setState({ drawPlate: pick.plate, drawSpinPlate: pick.plate, drawSettled: true });
      }
    }, 80);
  }
  redraw() { this.drawCheck(true); }
  confirmDraw() { if (this.state.drawPlate) this.startCheck(this.state.drawPlate); }
  closeDraw() { clearInterval(this._spin); this.setState({ drawOpen: false, drawSettled: false, drawPlate: null }); }

  // ---- check flow ----
  startCheck(plate) {
    const v = this.state.fleet.find((x) => x.plate === plate);
    const drv = (v && v.driver && v.driver !== 'Unassigned') ? v.driver : '';
    // Field pre-fills with the on-file driver; tapping into it clears for "someone else has it".
    // confirmDriverStart() falls back to on-file if the field is left empty.
    const base = {
      checkVan: plate, checkResults: {}, checkDefects: {},
      failSheet: null, checkSigned: false, checkDriver: drv, checkNoKeyholder: false,
      checkPhotoMap: {}, checkOdo: '', camera: null, drawOpen: false, drawSettled: false,
    };
    if (this.state.driverLaunch === 'fullscreen') {
      // Legacy: driver confirm is step 1 of the full-screen wizard.
      this.setState({ ...base, screen: 'check', checkStep: 'driver', driverSheet: null });
    } else {
      // Driver confirm is a launch gate — a bottom sheet over the launching screen. The
      // wizard itself doesn't open until Confirm, so the vehicle context stays behind it.
      this.setState({ ...base, checkStep: 'photos', driverSheet: plate });
    }
  }
  closeDriverSheet() { this.setState({ driverSheet: null }); }
  onChkDriver(v) { this.setState({ checkDriver: v }); }
  toggleNoKeyholder() { this.setState((s) => ({ checkNoKeyholder: !s.checkNoKeyholder, checkDriver: s.checkNoKeyholder ? s.checkDriver : '' })); }
  confirmDriverStart() {
    const st = this.state;
    let name = (st.checkDriver || '').trim();
    // Empty field but a driver is on file → confirm that one (the card shows it as the selection).
    if (!name && !st.checkNoKeyholder) {
      const v = st.fleet.find((x) => x.plate === st.checkVan);
      const onFile = v && v.driver && v.driver !== 'Unassigned' ? v.driver : '';
      if (onFile) { this.setState({ checkDriver: onFile }); name = onFile; }
    }
    if (!name && !st.checkNoKeyholder) return this.say('Confirm who has the vehicle first.');
    // Sheet path: this is the commitment boundary — dismiss the gate and open the full-screen
    // wizard at photos. Full-screen path: just advance the wizard one step.
    if (st.driverSheet) this.setState({ driverSheet: null, screen: 'check', checkStep: 'photos' });
    else this.setState({ checkStep: 'photos' });
  }
  // Spare / not-in-use path from the launch sheet: flag this vehicle out of rotation (it drops
  // from the draw pool + overdue counts) and spin the draw for a random replacement to check.
  skipAsSpare() {
    const plate = this.state.checkVan;
    const who = this.resolvedPerson();
    this.setState((s) => ({
      fleet: s.fleet.map((v) => (v.plate === plate ? {
        ...v, spare: true,
        log: [{ when: TODAY, who, what: 'Marked not in use (spare)', kind: 'note' }, ...(v.log || [])],
      } : v)),
      driverSheet: null, checkNoKeyholder: false, checkDriver: '', checkVan: null,
    }), () => { this.saveState(); this.drawCheck(false); });
  }
  // ---- camera ----
  // The capture UI is a single overlay driven by `camera`; `savePhoto` files the shot
  // wherever the overlay was opened from.
  capturePhoto(angle) { this.setState({ camera: { mode: 'angle', angle } }); }
  captureDefectPhoto() { this.setState({ camera: { mode: 'defect', angle: null } }); }
  closeCamera() { this.setState({ camera: null }); }
  savePhoto(uri) {
    const cam = this.state.camera;
    if (!cam || !uri) return this.setState({ camera: null });
    if (cam.mode === 'defect') {
      this.setState((s) => ({
        failSheet: { ...s.failSheet, photos: [...((s.failSheet && s.failSheet.photos) || []), uri] },
        camera: null,
      }), () => this.say('Photo attached to the defect.'));
      return;
    }
    if (cam.mode === 'doc') {
      this.setState((s) => ({
        docFiles: [...s.docFiles, uri],
        camera: null,
      }), () => this.say('File attached to the document.'));
      return;
    }
    this.setState((s) => ({
      checkPhotoMap: { ...s.checkPhotoMap, [cam.angle]: [...(s.checkPhotoMap[cam.angle] || []), uri] },
      camera: null,
    }), () => this.say(cam.angle + ' captured.'));
  }
  photosFor(angle) { return this.state.checkPhotoMap[angle] || []; }
  photoCount() {
    const m = this.state.checkPhotoMap || {};
    return Object.keys(m).reduce((t, k) => t + (m[k] || []).length, 0);
  }
  clearPhoto(angle) { this.setState((s) => { const m = { ...s.checkPhotoMap }; delete m[angle]; return { checkPhotoMap: m }; }); }
  chkToList() { this.setState({ checkStep: 'list' }); }
  chkToReview() { this.setState({ checkStep: 'review' }); }
  chkStep(step) { this.setState({ checkStep: step }); }
  passItem(id) { this.setState((s) => { const d = { ...s.checkDefects }; delete d[id]; return { checkResults: { ...s.checkResults, [id]: 'pass' }, checkDefects: d }; }); }
  openFailSheet(it) {
    const prev = this.state.checkDefects[it.id];
    this.setState({ failSheet: { itemId: it.id, text: it.text, desc: prev ? prev.desc : it.text, severity: prev ? prev.severity : 'Minor', due: prev ? prev.due : '', photos: (prev && prev.photos) || [] } });
  }
  failSet(patch) { this.setState((s) => ({ failSheet: { ...s.failSheet, ...patch } })); }
  cancelFail() { this.setState({ failSheet: null }); }
  removeFailPhoto(uri) { this.setState((s) => ({ failSheet: { ...s.failSheet, photos: (s.failSheet.photos || []).filter((u) => u !== uri) } })); }
  clearFailPhotos() { this.setState((s) => ({ failSheet: { ...s.failSheet, photos: [] } })); }
  saveFail() {
    const fs = this.state.failSheet; if (!fs) return;
    const desc = (fs.desc || '').trim();
    if (!desc) return this.say('Describe what is wrong first.');
    this.setState((s) => ({
      checkResults: { ...s.checkResults, [fs.itemId]: 'fail' },
      checkDefects: { ...s.checkDefects, [fs.itemId]: { desc, severity: fs.severity, due: fs.due, photos: fs.photos || [] } },
      failSheet: null,
    }), () => this.say('Defect noted.'));
  }
  onChkOdo(v) { this.setState({ checkOdo: v }); }
  signCheck() { this.setState((s) => ({ checkSigned: !s.checkSigned })); }
  chkDriverUseOnFile() {
    const v = this.state.fleet.find((x) => x.plate === this.state.checkVan);
    this.setState({ checkDriver: (v && v.driver && v.driver !== 'Unassigned') ? v.driver : '' });
  }
  submitCheck() {
    if (!this.state.checkSigned) return this.say('Sign the declaration first.');
    const plate = this.state.checkVan;
    const results = this.state.checkResults;
    const defs = this.state.checkDefects || {};
    const failedItems = this.liveItems().filter((it) => results[it.id] === 'fail');
    const label = (it) => { const d = defs[it.id]; if (!d) return it.text; return (d.desc || it.text) + (d.severity ? ' · ' + d.severity : '') + (d.due ? ' · due ' + d.due : ''); };
    const failed = failedItems.map(label);
    const defectPhotos = failedItems.reduce((t, it) => t + (((defs[it.id] && defs[it.id].photos) || []).length), 0);
    const by = this.resolvedPerson();
    const map = this.state.checkPhotoMap || {};
    const angles = Object.keys(map);
    const photoN = this.photoCount() + defectPhotos;
    // One representative frame per angle, so Approvals can show what was actually shot.
    const shots = angles.map((a) => ({ angle: a, uri: (map[a] || [])[0] || null }));
    const odoNum = parseInt((this.state.checkOdo || '').replace(/[^0-9]/g, ''), 10);
    const odoIn = (!isNaN(odoNum) && odoNum > 0) ? odoNum : null;
    const keyholder = (this.state.checkDriver || '').trim() || 'No driver assigned';
    const passedN = this.liveItems().filter((it) => results[it.id] === 'pass').length;
    this.setState((s2) => ({
      fleet: s2.fleet.map((v) => {
        if (v.plate !== plate) return v;
        const jobs = [...v.jobs];
        failed.forEach((t) => { if (!jobs.includes(t)) jobs.push(t); });
        const entry = { date: TODAY, by, result: failed.length ? 'Fault found' : 'Passed', photos: photoN };
        const confirmedDrv = (this.state.checkDriver || '').trim();
        const nextDriver = confirmedDrv || 'Unassigned';
        return { ...v, last: 0, odo: odoIn == null ? v.odo : odoIn, driver: nextDriver, jobs, history: [entry, ...(v.history || [])] };
      }),
      queue: [{
        id: nextId('q'), plate, by, date: TODAY, result: failed.length ? 'Fault found' : 'Passed',
        defects: failed.length, note: failed[0] || '',
        submission: { odo: odoIn, photos: photoN, passed: passedN, failedItems: failed, keyholder, angles, shots, signedBy: by },
      }, ...s2.queue],
      checkStep: 'done',
    }), () => this.saveState());
  }
  finishCheck() { this.setState({ screen: 'vans', checkVan: null }); }

  // ================= Pass 4: settings · config · people · profile · admin · help =================

  // ---- settings ----
  setDepot(v) { this.setState({ depotName: v }, () => this.saveState()); }
  commitDepot() {
    const name = (this.state.depotName || '').trim();
    if (!name) { this.setState({ depotName: 'Chullora CPDC' }, () => this.saveState()); return this.say('A depot needs a name — put the default back.'); }
    this.saveState();
    this.say('Depot name saved.');
  }
  setDepotAddr(v) { this.setState({ depotAddr: v }, () => this.saveState()); }
  setGeofence(v) { this.setState({ geofenceRadius: (v || '').replace(/[^0-9]/g, '').slice(0, 4) }, () => this.saveState()); }
  toggleLocationGate() { this.setState((s) => ({ locationGate: !s.locationGate }), () => this.saveState()); }
  toggleDeviceBinding() { this.setState((s) => ({ deviceBinding: !s.deviceBinding }), () => this.saveState()); }
  regenAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — avoids read-back mistakes
    const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    this.setState({ accessCode: seg(3) + '-' + seg(3) }, () => { this.saveState(); this.say('New access code generated.'); });
  }

  // A backup is a second slot in device storage, not a file on disk — nothing here can
  // reach a downloads folder without a file-system dependency.
  metaOf(b) {
    const d = (b && b.data) || {};
    const fleet = d.fleet || [];
    return {
      savedAt: (b && b.savedAt) || TODAY,
      vans: fleet.length,
      checks: (d.approved || []).length + (d.queue || []).length,
      defects: fleet.reduce((t, v) => t + ((v.jobs || []).length), 0),
    };
  }
  async doBackup() {
    const data = {};
    PERSIST_KEYS.forEach((k) => { data[k] = this.state[k]; });
    const rec = { savedAt: TODAY, data };
    try {
      await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(rec));
      this.setState({ backupMeta: this.metaOf(rec) });
      this.say('Backup saved on this device.');
    } catch (e) { this.say('Could not save the backup.'); }
  }
  async openRestore() {
    try {
      const raw = await AsyncStorage.getItem(BACKUP_KEY);
      if (!raw) return this.say('No backup on this device yet.');
      const b = JSON.parse(raw);
      if (!b || !b.data) return this.say('That backup is unreadable.');
      this.setState({ restoreOpen: true, backupMeta: this.metaOf(b) });
    } catch (e) { this.say('Could not read the backup.'); }
  }
  cancelRestore() { this.setState({ restoreOpen: false }); }
  async confirmRestore() {
    try {
      const raw = await AsyncStorage.getItem(BACKUP_KEY);
      const b = raw ? JSON.parse(raw) : null;
      if (!b || !b.data) { this.setState({ restoreOpen: false }); return this.say('That backup is unreadable.'); }
      const patch = { restoreOpen: false };
      PERSIST_KEYS.forEach((k) => { if (b.data[k] !== undefined) patch[k] = b.data[k]; });
      this.setState(patch, () => { this.saveState(); this.say('Restored from the backup of ' + b.savedAt + '.'); });
    } catch (e) { this.setState({ restoreOpen: false }); this.say('Could not restore.'); }
  }

  openResetModal() { this.setState({ resetModal: true, resetReason: '' }); }
  closeResetModal() { this.setState({ resetModal: false, resetReason: '' }); }
  onResetReason(v) { this.setState({ resetReason: v }); }
  doReset() {
    if (!(this.state.resetReason || '').trim()) return this.say('Say why you are emptying the depot.');
    const fleet = genVans();
    this.setState({
      depotName: 'Chullora CPDC',
      depotAddr: '88 Rookwood Rd, Chullora NSW 2190',
      geofenceRadius: '150', locationGate: true, deviceBinding: true, accessCode: '4Q7-2K9',
      ...DEFAULT_RULES,
      fleet,
      people: seedPeople(),
      queue: seedQueue(fleet),
      approved: seedApproved(fleet),
      returned: [],
      photoAngles: [...DEFAULT_ANGLES],
      configGroups: seedCapGroups(),
      capOff: {},
      docTypes: [...DEFAULT_DOC_TYPES],
      docTypeNew: '', docTypeFiles: '1',
      vehicleUses: [...DEFAULT_USES],
      useNew: '',
      clVersion: CHECKLIST.version,
      resetModal: false, resetReason: '',
      viewPerson: null, draftRole: null, peopleSheet: null, peopleFilter: 'all',
      screen: 'more',
    }, () => { this.saveState(); this.say('Depot emptied — back to the template it shipped with.'); });
  }

  // ---- config: draw rules ----
  setRule(key, v) { this.setState({ [key]: v.replace(/[^0-9]/g, '') }, () => this.saveState()); }
  rulesBad() {
    const ex = parseInt(this.state.excludeDays, 10);
    const fo = parseInt(this.state.forceDays, 10);
    if (isNaN(ex) || isNaN(fo)) return true;
    return fo <= ex;
  }

  // ---- config: photo angles ----
  onAngleNew(v) { this.setState({ angleNew: v }); }
  addAngle() {
    const name = (this.state.angleNew || '').trim();
    if (!name) return this.say('Name the angle first.');
    if (this.state.photoAngles.some((a) => a.toLowerCase() === name.toLowerCase())) return this.say('That angle is already on the list.');
    this.setState((s) => ({ photoAngles: [...s.photoAngles, name], angleNew: '' }), () => { this.saveState(); this.say('Angle added.'); });
  }
  moveAngle(i, dir) {
    const j = i + dir;
    this.setState((s) => {
      if (j < 0 || j >= s.photoAngles.length) return {};
      const a = [...s.photoAngles];
      const t = a[i]; a[i] = a[j]; a[j] = t;
      return { photoAngles: a };
    }, () => this.saveState());
  }
  removeAngle(i) {
    if (this.state.photoAngles.length <= 1) return this.say('Keep at least one photo angle.');
    this.setState((s) => ({ photoAngles: s.photoAngles.filter((a, k) => k !== i) }), () => { this.saveState(); this.say('Angle removed.'); });
  }

  // ---- config: document types (name + how many files the type expects) ----
  onDocTypeNew(v) { this.setState({ docTypeNew: v }); }
  onDocTypeFiles(v) { this.setState({ docTypeFiles: v.replace(/[^0-9]/g, '') }); }
  addDocType() {
    const name = (this.state.docTypeNew || '').trim();
    if (!name) return this.say('Name the document type first.');
    if (this.state.docTypes.some((d) => d.name.toLowerCase() === name.toLowerCase())) return this.say('That document type already exists.');
    const n = parseInt(this.state.docTypeFiles, 10);
    const files = isNaN(n) || n < 1 ? 1 : n;
    this.setState((s) => ({
      docTypes: [...s.docTypes, { name, files }], docTypeNew: '', docTypeFiles: '1',
    }), () => { this.saveState(); this.say('Document type added.'); });
  }
  removeDocType(i) {
    this.setState((s) => ({ docTypes: s.docTypes.filter((d, k) => k !== i) }), () => { this.saveState(); this.say('Document type removed.'); });
  }

  // ---- config: vehicle use types (PRV, BUS, and whatever a depot adds) ----
  onUseNew(v) { this.setState({ useNew: v }); }
  addUse() {
    const name = (this.state.useNew || '').trim();
    if (!name) return this.say('Name the use type first.');
    if (this.state.vehicleUses.some((u) => u.toLowerCase() === name.toLowerCase())) return this.say('That use type already exists.');
    this.setState((s) => ({ vehicleUses: [...s.vehicleUses, name], useNew: '' }), () => { this.saveState(); this.say('Use type added.'); });
  }
  removeUse(i) {
    if (this.state.vehicleUses.length <= 1) return this.say('Keep at least one use type.');
    this.setState((s) => ({ vehicleUses: s.vehicleUses.filter((u, k) => k !== i) }), () => { this.saveState(); this.say('Use type removed.'); });
  }

  // ---- config: hidden edit gesture (550ms hold, or three taps inside 600ms) ----
  holdStart() {
    clearTimeout(this._hold);
    this._hold = setTimeout(() => this.toggleAddValue(), 550);
  }
  holdEnd() { clearTimeout(this._hold); }
  tapOpen() {
    this._taps = (this._taps || 0) + 1;
    clearTimeout(this._tapTimer);
    if (this._taps >= 3) { this._taps = 0; this.toggleAddValue(); return; }
    this._tapTimer = setTimeout(() => { this._taps = 0; }, 600);
  }
  toggleAddValue() {
    this.setState((s) => ({ showAddValue: !s.showAddValue, capEdit: null }),
      () => this.say(this.state.showAddValue ? 'Editing on — capabilities can be changed.' : 'Editing off.'));
  }

  // ---- config: roles & capabilities ----
  toggleGroup(role) { this.setState((s) => ({ groupOpen: s.groupOpen === role ? '' : role, capEdit: null })); }
  toggleCfg(key) { this.setState((s) => ({ [key]: !s[key] })); }
  capOn(role, name) { return !this.state.capOff[capKey(role, name)]; }
  toggleCap(role, name) {
    const k = capKey(role, name);
    this.setState((s) => {
      const off = { ...s.capOff };
      if (off[k]) delete off[k]; else off[k] = true;
      return { capOff: off };
    }, () => this.saveState());
  }
  onCapNew(role, v) { this.setState((s) => ({ capNew: { ...s.capNew, [role]: v } })); }
  addCap(role) {
    const name = ((this.state.capNew || {})[role] || '').trim();
    if (!name) return this.say('Name the capability first.');
    const grp = this.state.configGroups.find((g) => g.role === role);
    if (grp && grp.caps.some((c) => c.name.toLowerCase() === name.toLowerCase())) return this.say('That capability already exists.');
    this.setState((s) => ({
      configGroups: s.configGroups.map((g) => (g.role === role
        ? { ...g, caps: [...g.caps, { name, desc: 'Added at this depot.', seed: false }] } : g)),
      capNew: { ...s.capNew, [role]: '' },
    }), () => { this.saveState(); this.say('Capability added to ' + this.roleLabel(role) + '.'); });
  }
  removeCap(role, idx) {
    const grp = this.state.configGroups.find((g) => g.role === role);
    const cap = grp && grp.caps[idx];
    if (!cap) return;
    if (cap.seed) return this.say('That one ships with the app — switch it off instead.');
    this.setState((s) => ({
      configGroups: s.configGroups.map((g) => (g.role === role
        ? { ...g, caps: g.caps.filter((c, i) => i !== idx) } : g)),
    }), () => { this.saveState(); this.say('Capability removed.'); });
  }
  startCapEdit(role, idx, text) { this.setState({ capEdit: { role, idx, text } }); }
  onCapEdit(v) { this.setState((s) => ({ capEdit: { ...s.capEdit, text: v } })); }
  cancelCapEdit() { this.setState({ capEdit: null }); }
  saveCapEdit() {
    const e = this.state.capEdit;
    if (!e) return;
    const text = (e.text || '').trim();
    if (!text) return this.say('A capability needs a name.');
    this.setState((s) => ({
      configGroups: s.configGroups.map((g) => (g.role === e.role
        ? { ...g, caps: g.caps.map((c, i) => (i === e.idx ? { ...c, name: text } : c)) } : g)),
      capEdit: null,
    }), () => { this.saveState(); this.say('Capability renamed.'); });
  }

  // ---- roles ----
  // 'Admin' is stored, but it reads as a Manager who also holds system-admin access.
  roleLabel(role) { return role === 'Admin' ? 'Manager +' : role; }
  baseRoleOf(role) { return role === 'Admin' ? 'Manager' : role; }
  capsUpTo(role) {
    const order = ['Inspector', 'Manager', 'Admin'];
    const top = order.indexOf(role);
    return this.state.configGroups.filter((g) => order.indexOf(g.role) <= (top < 0 ? 0 : top));
  }

  // ---- people ----
  roster() { return this.state.people.filter((p) => this.roleOf(p.name) !== 'Admin'); }
  peopleList() {
    const r = this.roster();
    const mgrs = r.filter((p) => this.roleOf(p.name) !== 'Inspector');
    const insps = r.filter((p) => this.roleOf(p.name) === 'Inspector');
    const all = [...mgrs, ...insps];
    const f = this.state.peopleFilter;
    return f === 'all' ? all : all.filter((p) => this.baseRoleOf(this.roleOf(p.name)) === f);
  }
  setPeopleFilter(f) { this.setState({ peopleFilter: f }); }
  openAddPerson() { this.setState({ peopleSheet: { mode: 'add', name: '' }, peopleNew: '', peopleNewRole: 'Inspector' }); }
  openManagePerson(name) { this.setState({ peopleSheet: { mode: 'manage', name } }); }
  closePeopleSheet() { this.setState({ peopleSheet: null, peopleNew: '' }); }
  onPeopleNew(v) { this.setState({ peopleNew: v }); }
  setNewRole(r) { this.setState({ peopleNewRole: r }); }
  addPerson() {
    const name = (this.state.peopleNew || '').trim();
    if (!name) return this.say('Enter a name.');
    if (this.state.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return this.say('That person is already on the depot.');
    const role = this.state.peopleNewRole || 'Inspector';
    this.setState((s) => ({
      people: [...s.people, { name, role, ini: initials(name), suspended: false, since: 'August 2026' }],
      peopleSheet: null, peopleNew: '',
    }), () => { this.saveState(); this.say(name + ' added as ' + (role === 'Manager' ? 'a Manager' : 'an Inspector') + '.'); });
  }
  toggleSuspend(name) {
    let now = false;
    this.setState((s) => ({
      people: s.people.map((p) => {
        if (p.name !== name) return p;
        now = !p.suspended;
        return { ...p, suspended: now };
      }),
      peopleSheet: null,
    }), () => { this.saveState(); this.say(now ? name + " suspended — they can't sign in." : name + ' reinstated.'); });
  }
  deletePerson(name) {
    if (name === this.resolvedPerson()) return this.say("You can't delete your own account.");
    this.setState((s) => ({
      people: s.people.filter((p) => p.name !== name),
      peopleSheet: null,
      viewPerson: s.viewPerson === name ? null : s.viewPerson,
      screen: s.viewPerson === name ? 'people' : s.screen,
    }), () => { this.saveState(); this.say(name + ' removed from the depot.'); });
  }

  // ---- profile ----
  openPerson(name) { this.setState({ screen: 'profile', viewPerson: name, draftRole: null, profRoleOpen: false, profCapsOpen: false, peopleSheet: null }); }
  personRecord() {
    const name = this.state.viewPerson || this.resolvedPerson();
    return this.state.people.find((p) => p.name === name) || { name, role: this.roleOf(name), ini: initials(name), suspended: false, since: '—' };
  }
  effRole() {
    const committed = this.roleOf(this.personRecord().name);
    return this.state.draftRole !== null ? this.state.draftRole : committed;
  }
  roleDirty() {
    const committed = this.roleOf(this.personRecord().name);
    return this.state.draftRole !== null && this.state.draftRole !== committed;
  }
  setDraftRole(r) { this.setState({ draftRole: r, profRoleOpen: false }); }
  toggleProfRole() { this.setState((s) => ({ profRoleOpen: !s.profRoleOpen })); }
  toggleProfCaps() { this.setState((s) => ({ profCapsOpen: !s.profCapsOpen })); }
  toggleGrantAdmin() {
    const eff = this.effRole();
    this.setState({ draftRole: eff === 'Admin' ? 'Manager' : 'Admin' });
  }
  discardRole() { this.setState({ draftRole: null, profRoleOpen: false }); }
  saveRole() {
    const rec = this.personRecord();
    const role = this.state.draftRole;
    if (role === null) return;
    this.setState((s) => ({
      people: s.people.map((p) => (p.name === rec.name ? { ...p, role } : p)),
      draftRole: null, profRoleOpen: false,
    }), () => { this.saveState(); this.say(rec.name + ' is now ' + this.roleLabel(role) + '.'); });
  }
  // Counts come from the records themselves, so the tiles can never disagree with Approvals.
  statsFor(name) {
    const done = this.state.approved.filter((a) => a.by === name);
    return {
      month: done.length + this.state.queue.filter((q) => q.by === name).length,
      week: done.filter((a) => a.week).length,
      defects: done.reduce((t, a) => t + (a.defects || 0), 0),
    };
  }
  vansFor(name) { return this.state.fleet.filter((v) => v.driver === name); }

  // ---- help ----
  toggleHelp(id) { this.setState((s) => ({ helpOpen: s.helpOpen === id ? '' : id })); }
}

export const store = new Store();

const StoreCtx = createContext(store);
export function StoreProvider({ children }) {
  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}
export function useStore() {
  const s = useContext(StoreCtx);
  useSyncExternalStore(s.subscribe, s.getSnapshot, s.getSnapshot);
  return s;
}
