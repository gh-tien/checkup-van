/* =========================================================================
   Fleet Spot-Check — depot manager app
   Zero dependencies. Ported from the Claude Design source
   "Fleet Spot-Check Manager v2.dc.html" (kept in design/ for reference).

   Architecture: state -> derive -> HTML string -> innerHTML, with event
   delegation via data-a attributes and focus/caret restoration across
   re-renders. Small enough that full re-render beats a diffing layer.
   ========================================================================= */
'use strict';

/* ---------------------------------------------------------------- build --- */

/* Which build this phone is actually running, shown in the header's left
   gutter. Not decoration: this app updates by service worker, so a phone can
   sit on a stale cached shell for a whole shift while the site serves something
   newer, and "did my fix reach the depot?" has until now only been answerable
   by digging through DevTools. Now you read it off the header.

   MUST equal VERSION in sw.js. They are separate files with no shared module,
   so this is a hand-kept pair — `.publish/stage.ps1` refuses to stage a build
   where the two disagree, which is what keeps it honest. Bump both together. */
const BUILD = 'v28';

/* ---------------------------------------------------------------- data --- */

/* Option lists — what the UI offers, not what gets stored. Records hold plain
   strings and ISO dates (record shapes are documented at the top of store.js).
   MODELS is only a datalist of suggestions now; a depot can run anything with
   wheels, so the field stays free text. */

const MODELS = ['Ford Transit Custom', 'Vauxhall Vivaro', 'Mercedes Sprinter', 'VW Crafter'];

/* ---------------------------------------------------------------- dates --- */
/* Storage is ISO ('2026-08-13'), display is human ('13 Aug'). The conversion
   lives here so no record ever holds a formatted string. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = n => String(n).padStart(2, '0');

const dmy = iso => {
  if (!iso) return '';
  const p = String(iso).split('-');
  return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1];
};
/* ISO date N days either side of another, via a real Date so month and year
   ends carry properly. Local, to match dayOf(). */
const shiftDays = (iso, n) => {
  const p = String(iso).split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2] + n);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
};
/* Timestamps are stored in UTC and shown on the depot's clock. */
const dayOf = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
};
const hhmm = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
};

/* ------------------------------------------------------- checklist seed --- */
/* The one thing a new depot starts with. It is starting configuration, not
   demo data: the manager edits it in More -> Checklist and publishes. Vans,
   people, workshops, checks and defects all start empty — a depot enters its
   own. SEED itself is defined under buildList(), where it can be built. */

const LIVE_LIST = [
  { name: 'Engine & fluids', items: [['Engine oil level', 0, ''], ['Engine coolant level', 0, ''], ['Brake fluid level', 1, ''], ['Power steering fluid', 0, ''], ['Leaks / drips underneath', 1, 'Look underneath, not just around it']] },
  { name: 'Lights & electrical', items: [['Headlights — low beam', 1, ''], ['Headlights — high beam', 0, ''], ['Brake lights', 1, 'Second person watches'], ['Indicators — front & rear', 1, ''], ['Hazard lights', 0, ''], ['Reverse lights', 0, ''], ['Park lights', 0, ''], ['Number plate lights', 0, '']] },
  { name: 'Wheels & tyres', items: [['Tyre condition & tread', 1, 'MEASURED · MM · LIMIT 1.5'], ['Tyre pressure', 1, 'MEASURED · KPA · PLACARD 340 / 380'], ['Rims — no cracks or damage', 0, ''], ['Spare tyre present & inflated', 0, ''], ['Wheel nuts secure', 1, '']] },
  { name: 'Body & safety', items: [['Windscreen — vision clear', 1, 'Chips in the swept area count'], ['Wipers operational', 0, ''], ['Mirrors clean & adjusted', 0, ''], ['Seatbelts condition & lock', 1, ''], ['Doors open, close & latch', 0, ''], ['Horn operational', 0, ''], ['Plates present & legible', 0, ''], ['Registration current', 1, 'Check label / certificate']] },
  { name: 'Cargo & equipment', items: [['Cargo area clean & safe', 0, 'No sharp edges or protrusions'], ['Load restraints available', 0, ''], ['First aid kit', 0, 'Contents within expiry'], ['Faulty equipment labels', 0, ''], ['No loose items in cab', 0, 'Projectiles in a hard stop']] }
];

const UNITS = ['mm', 'kPa', '%', 'V', 'L'];
const STEP = { mm: 0.1, kPa: 10, '%': 5, V: 0.5, L: 0.5 };
const PARTS = ['Single reading', 'Front & rear', 'Four corners'];
const MEASURED_CFG = {
  'Tyre condition & tread': { unit: 'mm', parts: 2, limit: 1.5, warn: 2, dir: 'below' },
  'Tyre pressure': { unit: 'kPa', parts: 1, limit: 300, warn: 330, dir: 'below' }
};

const buildList = () => LIVE_LIST.map((s, si) => ({
  id: 's' + si, name: s.name, retired: false,
  items: s.items.map((it, ii) => {
    const m = MEASURED_CFG[it[0]];
    return {
      id: 'i' + si + '_' + ii, name: it[0], crit: !!it[1], hint: m ? '' : it[2], retired: false, added: false,
      type: m ? 'm' : 'pf', unit: m ? m.unit : 'mm', parts: m ? m.parts : 0,
      limit: m ? m.limit : 1, warn: m ? m.warn : 2, dir: m ? m.dir : 'below'
    };
  })
}));

/* Applied once, to an empty database, and never again — so a wipe gives a
   blank depot with a fresh copy of the template, not the last edit of it. */
const SEED = () => ({
  checklist: buildList(),
  settings: { checklistVersion: 1, checklistPublishedOn: '' }
});

const fmt = (v, unit) => (STEP[unit] < 1 ? Number(v).toFixed(1) : String(Math.round(v)));

/* 'admin' is deliberately here but not in the role toggle or any crew list: it
   is the hidden setup role. An admin bootstraps the depot (people, vans,
   workshops, draw rules) but never checks a van and never countersigns, so it
   is kept off every screen the crew see. The label exists only for the admin's
   own header and their own admin area. */
const ROLE_LABEL = { inspector: 'Inspector', manager: 'Manager', admin: 'Admin' };

/* The draw rules a depot can set, with the range each one is allowed to hold.
   They live in Store settings, not in S: they are depot policy, the same for
   everyone, and a phone that has never opened Coverage must still draw by
   them. `min` is not decoration — a 0-day exclusion window means the same van
   can be drawn twice in a morning. */
const RULES = [
  { key: 'excludeDays', label: 'Exclude if checked within', unit: 'days', min: 1, max: 90 },
  { key: 'forceDays', label: 'Force any van past', unit: 'days', min: 7, max: 365 },
  { key: 'rerolls', label: 'Re-rolls per check', unit: '', min: 0, max: 5 },
  { key: 'targetPerWeek', label: 'Target per week', unit: 'checks', min: 1, max: 200 }
];

const FILTERS = ['All', 'Active only', 'Off road', 'Retired'];
const STATUS_META = { active: ['Active', 'ink'], offroad: ['Off road', 'red'], retired: ['Retired', 'faint'] };

const REASONS = [
  'Photos too dark or blurred to judge',
  "Reading doesn't match what the photo shows",
  'Defect note too thin to raise a job on',
  'Item marked N/A with no reason given',
  "Wrong van — reg doesn't match the plate photo",
  "Something else — I'll write it"
];
const SCOPES = ['Just the part I’ve flagged', 'The whole check, from the start'];

/* --------------------------------------------------------------- state --- */

/* S is UI state: what is selected, what is half-typed, what is expanded.
   Domain records live in Store and are never copied into here — a screen
   reads them fresh on every render. */
const STORAGE_KEY = 'spotcheck.ui.v3';

const freshState = () => ({
  selectedId: null, sendingBack: false,
  sbReason: null, sbScope: 0, sbHold: true, sbNote: '',
  /* A real workshop id and a real ISO date, not positions in a list. A
     position silently means a different workshop the moment one is added,
     renamed or retired between opening the check and countersigning it. */
  assigneeId: '', dueOn: '', offRoad: false,
  /* Half-typed draw rules, keyed by settings key. A rule only reaches the
     store once it parses inside its range, so an empty field mid-edit can
     never be saved as "exclude nothing". Cleared on leaving the screen. */
  ruleDraft: {},
  /* The van the draw landed on, how many re-rolls this run has spent, and
     which vans it has already offered. Device-local and deliberately NOT in
     the store: a draw is one person about to walk one van, not depot policy,
     and two phones drawing at the same moment must not overwrite each other.
     It survives a reload on purpose — a phone that locked in the yard should
     come back still holding the van it drew, not asking you to draw again. */
  draw: { vanId: '', rolls: 0, seen: [] },
  vanSelId: null, adding: false, filterIdx: 0,
  draft: { id: null, reg: '', model: '', status: 'active', bay: '', motDue: '' },
  /* The unpublished checklist draft. null until the store has loaded, then a
     working copy of the published list — the published one lives in Store. */
  list: null,
  secIdx: 0, addCount: 0, openId: null,
  /* The spot-check being walked right now, or null when there isn't one. It is
     a DRAFT and deliberately lives in S, not in Store: a half-walked check is
     not a record, and nothing half-walked should ever appear in the queue for
     someone to countersign. It becomes a `checks` row at submit, once. */
  cap: null,
  /* Discard sits a thumb's width from "Carry on" and throws away real work,
     so it arms first and acts on the second tap. */
  capArmDiscard: false,
  /* A picked-but-not-yet-restored backup, SUMMARISED — counts and a date, never
     the records themselves. The parsed database is held in `pendingImport`
     instead, because everything in S is stringified into localStorage on every
     keystroke and a depot's worth of records does not belong in that blob. */
  importSum: null,
  /* Emptying the depot is the most destructive thing in the app and used to
     happen on a single tap. Same rule as capArmDiscard now. */
  armReset: false,
  /* Who is holding this phone. '' = nobody signed in. It lives HERE, in the
     device-local UI blob, and deliberately not in the store's settings: a
     signature is a claim about who is standing at the van, and settings ride
     along inside a backup — restoring one would make the receiving phone
     silently claim to be whoever made the file. */
  userId: '',
  /* Delete arms before it acts, like armReset — but these hold the id of the
     row that is armed, because the screen is a list and only one row at a time
     should be one tap from gone. '' = nothing armed. */
  armDelPerson: '',
  armDelVan: '',
  /* The identity menu hanging off the header avatar. Open/closed is a gesture,
     not a setting — it is persisted only because everything in S is, and
     `load()` shuts it again so a phone that locked with it open does not come
     back to a floating card over a screen nobody remembers opening. */
  whoMenu: false,
  /* Which help sheet is open, by key — '' is closed. Same nature as whoMenu: a
     gesture, persisted only because everything in S is, and shut again by
     load() so a phone that locked with it up does not come back to a panel
     over a screen nobody remembers opening. */
  help: '',
  /* The setup modal that bootstraps the first admin. Open/closed is a gesture,
     persisted only because everything in S is, and shut again by load(); the
     half-typed admin name rides along the same way and is cleared on load so a
     reload never re-opens onto a stranger's half-typed name. */
  adminModal: false, adminName: ''
});

let S = freshState();

/* Navigation: one global stack. Switching tabs resets it, so Back always
   walks the trail the user actually took inside the current tab. */
let nav = { tab: 'queue', stack: [] };

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (_) { /* private mode */ }
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') S = { ...freshState(), ...parsed };
  } catch (_) { /* corrupt -> fresh */ }
  // First run, a corrupt blob, or a draft that predates the published list —
  // the repair below has to run in every one of those cases, so no early exit.
  if (!Array.isArray(S.list)) S.list = publishedList();
  if (S.secIdx >= S.list.length) S.secIdx = 0;
  /* Arming is a gesture, not a setting: it is saved only because everything in
     S is. A phone that locked between the two taps must not come back one tap
     away from emptying the depot. Same for a staged restore — the file it
     stood for lives in pendingImport, which a reload has already thrown away,
     so the card would sit there promising a restore that could not happen. */
  S.armReset = false;
  S.capArmDiscard = false;
  S.armDelPerson = '';
  S.armDelVan = '';
  S.whoMenu = false;
  S.help = '';
  S.adminModal = false;
  S.adminName = '';
  S.importSum = null;
  /* A blob written before the draw existed has no `draw` at all, and a corrupt
     one can have anything. Repair rather than trust: every read below indexes
     into it, and a draw that throws would take the whole home screen with it. */
  if (!S.draw || typeof S.draw !== 'object') S.draw = { vanId: '', rolls: 0, seen: [] };
  if (!Array.isArray(S.draw.seen)) S.draw = { ...S.draw, seen: [] };
  if (!Number.isFinite(S.draw.rolls)) S.draw = { ...S.draw, rolls: 0 };
}

function set(patch) {
  S = typeof patch === 'function' ? { ...S, ...patch(S) } : { ...S, ...patch };
  save();
  invalidate();
}

const cloneList = l => l.map(sec => ({ ...sec, items: sec.items.map(i => ({ ...i })) }));

function editList(fn) {
  const next = cloneList(S.list);
  if (!next[S.secIdx]) return;
  fn(next[S.secIdx].items, next);
  set({ list: next });
}
function editSecs(fn) {
  const next = cloneList(S.list);
  const extra = fn(next) || {};
  set({ list: next, ...extra });
}

/* ---------------------------------------------------------- primitives --- */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESCAPES[c]);
const cls = (...xs) => xs.filter(Boolean).join(' ');
/* Stored words like "major" / "awaiting" are lower-case keys, not display text —
   this is what turns one into the start of a sentence. */
const sentence = s => { const t = String(s == null ? '' : s); return t.charAt(0).toUpperCase() + t.slice(1); };

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h4l1.5 3h7L17 14h4"/><path d="M4.4 5.6A2 2 0 016.3 4.2h11.4a2 2 0 011.9 1.4L21 14v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z"/></svg>',
  defects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.9 18a2 2 0 001.7 3h16.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  coverage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  vans: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5A1.5 1.5 0 013.5 6H14v10H3.5A1.5 1.5 0 012 14.5z"/><path d="M14 9h3.6a2 2 0 011.7 1l2.2 3.4a2 2 0 01.3 1.1V16H14z"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l.9.9L6.6 5.2"/><path d="M4 12l.9.9L6.6 11.2"/><path d="M4 18l.9.9L6.6 17.2"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.8a3.4 3.4 0 00-3.4-3.4H6.4A3.4 3.4 0 003 18.2V20"/><circle cx="9.5" cy="7.6" r="3.4"/><path d="M21 20v-1.8a3.4 3.4 0 00-2.6-3.3"/><path d="M15.6 4.4a3.4 3.4 0 010 6.5"/></svg>',
  workshop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.6 6.4a3.9 3.9 0 005.2 5.1l-8 8a2.3 2.3 0 01-3.3-3.3l8-8z"/><path d="M14.6 6.4L11.9 3.7a3.9 3.9 0 00-5.2 5.2l2.7 2.7"/></svg>',
  /* one person, not the two-figure `people` glyph: this one stands for YOU in
     the header avatar, and the crowd icon would read as "the people list". */
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20v-1.8a4 4 0 00-4-4H9a4 4 0 00-4 4V20"/><circle cx="12" cy="7.4" r="3.8"/></svg>',
  /* The one glyph in here that means "there is more to read", not "go here". */
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.1"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'
};

const monoLabel = (text, mod) => `<div class="${cls('mono-label', mod)}">${esc(text)}</div>`;
const note = (text, mod) => `<p class="${cls('note', mod)}">${esc(text)}</p>`;

/* ---------------------------------------------------------------- help --- */

/* Guidance that used to sit permanently underneath the list it explained. It
   gets read once, understood, and from then on it is furniture: grey paragraphs
   the eye has to climb over on every visit to a screen whose actual job is a
   list of names. Standing notes also compete with the ones that matter — the
   red line that appears when Delete is armed says something about right now,
   and it lands harder on a screen that is not already three paragraphs deep.

   So the explanation moves behind a single (i) in the header. Nothing is lost;
   it is one tap away instead of always underfoot.

   Keyed by SCREEN NAME, not by heading. The first cut hung the (i) off a
   section label, which meant the screen had to keep a heading it did not
   otherwise need just to have something to hang it from — the tail wagging the
   dog. In the header it is chrome: it costs the content nothing, it lands in
   the same place on every screen that has one, and screens with no entry here
   simply show no button.

   A sheet, not a screen: it is an aside about where you already are, so it
   takes no place on the back stack and grows no Back button of its own. It
   closes on the scrim, on Close, or on Escape. */
const HELP = {
  queue: {
    title: 'How the van is picked',
    body: [
      'The app draws the van, not you. A spot-check is only worth anything if nobody chose where it landed — pick from a list and the same three easy vans get walked every week while the awkward one at the back of the yard never does.',
      'Only active vans go in. One that was checked in the last few days is held out so it can’t come up twice in a week, and any van left too long is forced to the front until somebody walks it. Both of those numbers are yours to set, in Settings.',
      'You can re-roll a draw a set number of times, and you can still check a named van when there is a reason to — a complaint, a return from the workshop. The draw is the default, not a lock.'
    ]
  },
  people: {
    title: 'Suspending and deleting',
    body: [
      'Suspending someone keeps every check they signed. They just can’t sign in — and their open defects stay on the depot’s list, not theirs.',
      'Deleting is for someone added by mistake. It removes them from the depot but never from a record they signed: a check copies the name onto itself when it is submitted, so past checks read the same afterwards.',
      'Suspend is the one to use for somebody who has left.'
    ]
  }
};

/* The (i) that sits inboard of the avatar, on the screens that have something
   to say. Nothing at all when the screen has no entry — an empty slot, not a
   greyed-out button, because a control that never does anything still asks to
   be understood. */
function topbarHelp(screen) {
  const help = HELP[screen];
  if (!help) return '';
  return `
    <button class="topbar-help" data-a="openHelp" data-id="${esc(screen)}" aria-haspopup="dialog"
            aria-label="${esc('About this screen: ' + help.title.toLowerCase())}">${ICON.info}</button>`;
}

/* The scrim dims here, unlike the identity menu's — this one IS a modal. It is
   a page of prose over a screen you have stopped working on, and the dimming is
   what says "read this, then come back" rather than "carry on around me". */
function helpSheet() {
  const help = HELP[S.help];
  if (!help) return '';
  return `
    <div class="sheet-scrim" data-a="closeHelp"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(help.title)}">
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title">${esc(help.title)}</h2>
      ${help.body.map(p => `<p class="sheet-p">${esc(p)}</p>`).join('')}
      <button class="btn btn-quiet" data-a="closeHelp">Close</button>
    </div>`;
}
/* Two different kinds of nothing, and they need opposite things said to them:
   a depot nobody has set up yet needs a way forward, a depot that is simply
   caught up needs reassurance — not a job it hasn't got. */
const emptyState = (title, body, cta) => `
  <div class="empty">
    ${monoLabel(title)}
    ${note(body, 'is-faint')}
    ${cta ? `<button class="btn-add" data-a="${esc(cta.action)}"${cta.id ? ` data-id="${esc(cta.id)}"` : ''}>${esc(cta.label)}</button>` : ''}
  </div>`;
const stat = (num, cap, alert) =>
  `<div class="${cls('stat', alert && 'is-alert')}"><div class="stat-num">${esc(num)}</div><div class="stat-cap">${esc(cap)}</div></div>`;

/* ---------------------------------------------------------- derivation --- */

/* Everything below reads Store on demand. No collection is cached in S — a
   stale copy is how two screens end up disagreeing about the same van. */

const fleetList = () => Store.all('vans');
const peopleList = () => Store.all('people');
const workshopList = () => Store.all('workshops').filter(w => w.active);
/* The picked workshop, but only if it is still a real, active one — a shop
   retired while the check sat in the queue must read as "not picked", never
   as whoever now sits at that position. */
const pickedShop = () => workshopList().filter(w => w.id === S.assigneeId)[0] || null;
const workshopName = id => {
  const w = Store.get('workshops', id);
  return w ? w.name : '';
};

/* Newest first — the queue is worked oldest-at-the-bottom. */
const allChecks = () => Store.all('checks').sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
const doneChecks = () => allChecks().filter(c => c.finishedAt);
const inFlightChecks = () => allChecks().filter(c => !c.finishedAt);
const pendingChecks = () => doneChecks().filter(c => !c.decision);
/* The queue holds only checks that still need something from the manager: the
   ones awaiting a countersign, plus the ones sent back and waiting to be
   resubmitted. A countersigned check is a finished document — it leaves the
   queue for History so the queue stops being a growing archive that outlives
   its own "awaiting your countersign" heading. */
const queueChecks = () => doneChecks().filter(c => c.decision !== 'countersigned');
/* The archive: countersigned checks, newest signature first. History is
   browsed, not worked oldest-up like the queue, so it sorts by when it was
   signed rather than when it was started. */
const historyChecks = () => doneChecks()
  .filter(c => c.decision === 'countersigned')
  .sort((a, b) => String(b.decidedAt || b.finishedAt).localeCompare(String(a.decidedAt || a.finishedAt)));
const selectedCheck = () => (S.selectedId && Store.get('checks', S.selectedId)) || doneChecks()[0] || null;
/* Every failed item on a check, not just the first. Before capture existed a
   check carried at most one fail, so one defect was all a countersign could
   ever raise. A real walk fails as many items as are wrong, and every one of
   them has to become a job — a fail the manager never sees is a fail nobody
   fixes. */
const failedResults = c => (c && c.results || []).filter(r => r.outcome === 'fail');

const checkFlag = c => {
  if (!c.failed) return 'Clean';
  const major = (c.results || []).some(r => r.outcome === 'fail' && r.severity === 'major');
  return c.failed + ' ' + (major ? 'major' : 'minor');
};
const crewLine = c => {
  const who = c.inspectorName + (c.secondName ? ' + ' + c.secondName : '');
  const when = hhmm(c.startedAt) + (c.finishedAt ? '–' + hhmm(c.finishedAt) : '');
  return who + ' · ' + when;
};

/* ---- coverage ----
   Days-since-last-check is derived from the check history itself, never from
   a running total: `vans.lastCheckOn` is a denormalised convenience, and if a
   check is ever deleted or re-dated the stored figure quietly stops being
   true. The history is the only thing that can't drift from itself. */

/* Whole days between two ISO dates, both read on the depot's own clock so a
   check walked at 23:50 is one day old the next morning, not 0.006. */
const daysBetween = (isoA, isoB) => {
  const p = s => { const x = String(s).split('-'); return new Date(+x[0], +x[1] - 1, +x[2]); };
  return Math.round((p(isoB) - p(isoA)) / 86400000);
};

/* Retired vans are history only — never drawn, and never counted against the
   depot's coverage. An off-road van still counts: it is still uncovered. */
const coverVans = () => fleetList().filter(v => v.status !== 'retired');

/* The last day each van was actually walked. A check that was sent back still
   happened — somebody stood at the van and looked — so it counts here even
   though its defects were never raised. */
function lastWalkedOn() {
  const m = {};
  doneChecks().forEach(c => {
    const day = dayOf(c.finishedAt);
    if (!c.vanId || !day) return;
    if (!m[c.vanId] || day > m[c.vanId]) m[c.vanId] = day;
  });
  return m;
}

/* One row per van, worst first. `days: null` means never walked, which is not
   "0 days ago" and not "a big number" — it sorts above every real figure,
   because a van nobody has ever checked is the one to check next. */
function coverageRows() {
  const walked = lastWalkedOn(), today = Store.today();
  return coverVans().map(v => {
    const on = walked[v.id] || '';
    return { van: v, on, days: on ? Math.max(0, daysBetween(on, today)) : null };
  }).sort((a, b) => {
    if (a.days === null || b.days === null) {
      if (a.days === b.days) return String(a.van.reg).localeCompare(String(b.van.reg));
      return a.days === null ? -1 : 1;
    }
    return b.days - a.days;
  });
}

/* The draw rules as real numbers, clamped to their declared range. A rule read
   back out of settings is used to decide what gets checked, so it is validated
   on the way out as well as on the way in. */
function drawRules() {
  const s = Store.settings();
  const out = {};
  RULES.forEach(r => {
    const n = Number(s[r.key]);
    out[r.key] = Number.isFinite(n) ? Math.min(r.max, Math.max(r.min, Math.round(n))) : r.min;
  });
  return out;
}
/* Never-walked counts as past every threshold: no date is older than any date. */
const isForced = (row, forceDays) => row.days === null || row.days > forceDays;
const isEligible = (row, excludeDays) => row.days === null || row.days > excludeDays;

/* What the draw is allowed to pick from, and why it is that set.

   Only active vans. An off-road van cannot be driven to be walked, and a
   retired one is not the depot's to walk any more — coverageRows() has
   already dropped those, so this only has to strip off-road.

   Forced beats eligible, and it is not a tie-break — it IS the rule. "Force
   any van past N days" promises that such a van is next, not that it merely
   joins the hat alongside everything else; a fleet with one van at 400 days
   and forty at 30 would otherwise leave the bad one a 1-in-41 shot every
   morning and it could hide for a month. So when anything is overdue, the hat
   holds nothing but the overdue ones. */
function drawPool() {
  const { excludeDays, forceDays } = drawRules();
  const all = coverageRows().filter(r => r.van.status === 'active');
  const forced = all.filter(r => isForced(r, forceDays));
  return {
    rows: forced.length ? forced : all.filter(r => isEligible(r, excludeDays)),
    forced: !!forced.length,
    total: all.length,
    excludeDays, forceDays
  };
}

/* Uniform over the hat, with one memory: a van this run has already offered
   drops out until every other van has had a turn. That is not a fairness rule
   — the pool itself is the fairness rule — it is so "pick another" cannot hand
   back the van you just declined, which reads as the app ignoring the tap. */
function pickRow(pool) {
  const fresh = pool.rows.filter(r => S.draw.seen.indexOf(r.van.id) < 0);
  const hat = fresh.length ? fresh : pool.rows;
  return hat[Math.floor(Math.random() * hat.length)] || null;
}

const openDefects = () => Store.where('defects', d => d.stage !== 'closed');
/* What a workshop is currently holding. Retiring one with jobs on it doesn't
   move the jobs, so the count is what stops that being a silent decision. */
const shopOpenCount = id => Store.count('defects', d => d.workshopId === id && d.stage !== 'closed');
const vanDefectCount = vanId => Store.count('defects', d => d.vanId === vanId && d.stage !== 'closed');

/* Overdue is a fact about today, not a stored stage — a defect left on disk
   overnight becomes overdue on its own. */
const defectStage = d => (d.stage === 'awaiting' && d.dueOn && d.dueOn < Store.today() ? 'overdue' : d.stage);
const defectMetaLine = d => {
  if (d.stage === 'verified') {
    return 'Repaired ' + dmy(d.repairedOn) + (d.recheckedBy ? ' · re-checked by ' + d.recheckedBy : '');
  }
  const parts = ['Raised ' + dmy(d.raisedOn)];
  const w = workshopName(d.workshopId);
  if (w) parts.push(w);
  parts.push(defectStage(d) === 'overdue' ? 'Overdue' : (d.dueOn ? 'Due ' + dmy(d.dueOn) : 'No due date'));
  return parts.join(' · ');
};

/* Who is signing. Resolved from S.userId on EVERY read, against the active
   people — so suspending or deleting somebody signs their phone out instead of
   sliding the identity quietly onto whoever now sits at that position. That
   slide is exactly what the old "first active manager" rule did, and it meant a
   countersignature could end up stamped with a name that never saw the van. */
const me = () => peopleList().filter(p => p.active && p.id === S.userId)[0] || null;
const meName = () => (me() ? me().name : '');
/* Initials for the header avatar — first letter of the first two words, so
   "Dan Whitrow" reads DW and a one-word name reads D. Decorative only: two
   people can share initials, and this app's whole output is a signature on a
   record, so the full name and role travel in the avatar's aria-label and stay
   spelled out in the meta line rather than being left to a two-letter guess. */
const initials = name =>
  String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
/* Countersigning and sending back are a manager's signature on someone else's
   work. Nobody signed in, or an inspector signed in, cannot do either. */
const isManager = () => { const p = me(); return !!p && p.role === 'manager'; };
/* Managers other than whoever is signed in — the people who could countersign a
   van you walked yourself. Active only: a suspended manager is not an option,
   and printing their name would send somebody off to find a person who can no
   longer sign anything. */
const otherManagers = () => peopleList().filter(p => p.active && p.role === 'manager' && p.id !== S.userId);
/* The setup gate. A depot with no people at all has never been bootstrapped:
   nobody can sign in, so nobody can add anybody. The first screen must be the
   one that creates the hidden admin, not the empty queue. Once a single person
   exists — admin or crew — the app runs normally. */
const needsSetup = () => Store.count('people') === 0;
/* The hidden setup role. Admins bootstrap the depot but never check a van and
   never countersign, so they are kept off every crew list (People, the
   identity switcher, the capture pickers) and reachable only through their own
   admin area. This is the one place that gathers them. */
const admins = () => peopleList().filter(p => p.role === 'admin');
/* "Dan", "Dan or Sam", "Dan, Sam or Jo". The note reads as a sentence, and
   "Dan, Sam" halfway through one reads as a database dump. */
const nameList = ns => ns.length < 2 ? (ns[0] || '') : ns.slice(0, -1).join(', ') + ' or ' + ns[ns.length - 1];
/* The published checklist — what the phones are running. S.list is the
   manager's unpublished draft of it; "dirty" is the difference. */
const publishedList = () => Store.all('checklist');
const liveSections = () => S.list.filter(s => !s.retired);
/* secIdx is a position in a list the manager reorders and adds to — never
   assume it still points at a section. */
const curSection = () => S.list[S.secIdx] || null;
const liveCount = () => liveSections().reduce((a, s) => a + s.items.filter(i => !i.retired).length, 0);
const isDirty = () => JSON.stringify(S.list) !== JSON.stringify(publishedList());
const checklistVersion = () => Store.settings().checklistVersion;
/* What this depot calls itself. Trimmed on the way out rather than on the way
   in, because trimming per keystroke makes the space in "Barking depot"
   impossible to type. '' means nobody has named it yet, and every caller says
   so in its own words — none of them invents one. */
const depotName = () => String(Store.settings().depotName || '').trim();
/* v1 has never been published by a human — it is what shipped. */
const liveSince = () => {
  const on = Store.settings().checklistPublishedOn;
  return (on ? 'Live since ' + dmy(on) : 'As shipped') + ' · v' + checklistVersion();
};

/* How many distinct edits are waiting to be published — mirrors the source
   logic exactly, including the "order changed counts as one" rule. */
function changeCount() {
  const baseItems = publishedList();
  const baseIds = {}, baseSecs = {};
  baseItems.forEach(s => { baseSecs[s.id] = s; s.items.forEach(i => { baseIds[i.id] = i; }); });
  const FIELDS = ['name', 'crit', 'retired', 'hint', 'type', 'unit', 'parts', 'limit', 'warn', 'dir'];
  let changes = S.list.reduce((a, s) => a + s.items.filter(i => {
    const b = baseIds[i.id];
    return !b || FIELDS.some(f => b[f] !== i[f]);
  }).length, 0);
  changes += S.list.filter(s => {
    const b = baseSecs[s.id];
    return !b || b.name !== s.name || b.retired !== s.retired;
  }).length;
  const order = l => JSON.stringify(l.map(s => [s.id, s.items.map(i => i.id)]));
  if (order(S.list) !== order(baseItems)) changes += 1;
  if (isDirty() && !changes) changes = 1;
  return changes;
}

/* ------------------------------------------------- capture derivation --- */

/* The walk reads the PUBLISHED checklist, never S.list. S.list is the
   manager's unpublished draft; a check already underway must not change shape
   because someone in the office is mid-edit. Retired sections and items are
   dropped at the start of the walk and stay dropped for its whole length. */

const capVans = () => fleetList().filter(v => v.status !== 'retired');
const capInspectors = () => peopleList().filter(p => p.active && p.role !== 'admin');
const capVan = () => (S.cap && Store.get('vans', S.cap.vanId)) || null;

const capSections = () => publishedList()
  .filter(s => !s.retired)
  .map(s => ({ ...s, items: s.items.filter(i => !i.retired) }))
  .filter(s => s.items.length);
const capSection = () => capSections()[S.cap ? S.cap.secIdx : 0] || null;
const capItems = () => (capSection() ? capSection().items : []);
const capAll = () => capSections().reduce((a, s) => a.concat(s.items.map(i => ({ it: i, sec: s }))), []);

/* One reading, front & rear, or four corners — the labels the fitter uses at
   the van, not "value 1..4". parts is 0/1/2 on the item; the count follows. */
const PART_LABELS = [
  ['Reading'],
  ['Front', 'Rear'],
  ['O/S front', 'N/S front', 'O/S rear', 'N/S rear']
];
const partNames = it => PART_LABELS[it.parts] || PART_LABELS[0];

const blankRes = it => ({
  outcome: '', values: partNames(it).map(() => ''), note: '', severity: '', safeToDrive: null
});
const capRes = id => (S.cap && S.cap.res[id]) || null;

/* A single reading against the item's own limits. '' means not entered yet —
   deliberately not 0, because 0.0 mm of tread is a real and very bad reading.
   'warn' is still a pass; it is worth seeing but it is not a defect. */
const readingState = (it, v) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  if (!isFinite(n)) return '';
  const past = (a, b) => (it.dir === 'above' ? a > b : a < b);
  if (past(n, it.limit)) return 'fail';
  if (past(n, it.warn)) return 'warn';
  return 'ok';
};
/* The outcome of a measured item is not something the inspector picks — it
   falls out of the numbers. Any reading past the limit fails the item; a
   single blank leaves it unanswered rather than quietly passing it. */
const measuredOutcome = (it, values) => {
  const states = (values || []).map(v => readingState(it, v));
  if (states.length !== partNames(it).length || states.some(s => !s)) return '';
  return states.some(s => s === 'fail') ? 'fail' : 'pass';
};

const capAnswered = id => !!(capRes(id) && capRes(id).outcome);
const capDone = sec => sec.items.filter(i => capAnswered(i.id)).length;
const capLeft = () => capAll().filter(e => !capAnswered(e.it.id)).length;
const capFails = () => capAll().filter(e => capRes(e.it.id) && capRes(e.it.id).outcome === 'fail');
/* A fail with no note is a job nobody can act on. Two characters is not a
   quality bar, it is a "something was actually typed" bar. */
const capThinNotes = () => capFails().filter(e => (capRes(e.it.id).note || '').trim().length < 3).length;
const capReady = () => !!S.cap && !capLeft() && !capThinNotes();

const capTally = () => {
  const all = capAll();
  const of = o => all.filter(e => capRes(e.it.id) && capRes(e.it.id).outcome === o).length;
  return { total: all.length, pass: of('pass'), fail: of('fail'), na: of('na') };
};

/* ------------------------------------------------------------- screens --- */

const TABS = [
  /* The id stays `queue` — it is the tab key, the screen key and the target of
     half a dozen "go here" buttons, and renaming it would ripple through all of
     them to change nothing anybody sees. The LABEL is what people read, and one
     word is all a tab has room for at 375px. */
  { id: 'queue', label: 'Check', icon: 'queue' },
  { id: 'defects', label: 'Defects', icon: 'defects' },
  { id: 'vans', label: 'Vans', icon: 'vans' },
  { id: 'more', label: 'More', icon: 'more' }
];

const currentScreen = () => nav.stack.length ? nav.stack[nav.stack.length - 1] : nav.tab;

/* --- Queue: list -------------------------------------------------------- */

/* The walk that is open on THIS phone right now. It lives in S, not in the
   store, so it is deliberately not one of the queue rows: it is not a record
   yet and there is nothing on it anybody could countersign. It still has to be
   visible from the queue, or a half-finished check is invisible until the
   inspector remembers it exists. */
function capDraftCard() {
  // A draft with no start time is an abandoned setup screen, not real work.
  if (!S.cap || !S.cap.startedAt) return '';
  const van = capVan();
  const total = capAll().length;
  const answered = total - capLeft();
  const armed = S.capArmDiscard;

  return `
    <div class="card is-dashed-amber">
      <div class="spread">
        <span class="reg" style="color:var(--amber)">${esc(van ? van.reg : 'Spot-check')}</span>
        <span class="flag is-amber">Not submitted</span>
      </div>
      <div class="mono-label is-amber">${esc('Started ' + hhmm(S.cap.startedAt) + ' · ' + answered + ' of ' + total + ' answered')}</div>
      ${note(armed
        ? 'Discarding loses every answer on this walk. There is no undo — tap again if that is what you want.'
        : 'Still open on this phone. It reaches the queue when it is submitted, not before.', armed ? 'is-red' : 'is-faint')}
      <div class="dock-row">
        <button class="${cls('btn', armed ? 'btn-danger' : 'btn-outline')}" data-a="capDiscard">${armed ? 'Tap again to discard' : 'Discard'}</button>
        <button class="btn is-wide btn-primary" data-a="startCapture">Carry on</button>
      </div>
    </div>`;
}

/* One tappable check row — shared by the queue, by History, and by a van's own
   history. `dim` greys a settled row so it recedes among the live ones in the
   queue; History and van history browse settled records, so they pass false and
   read at full strength. */
function checkRow(c, dim = true) {
  const d = c.decision;
  const flag = d === 'countersigned' ? 'Countersigned ✓' : d === 'sent-back' ? 'Sent back' : checkFlag(c);
  const flagMod = d === 'countersigned' ? '' : d === 'sent-back' ? 'is-faint' : (c.failed ? 'is-red' : '');
  const dormant = dim && d;
  return `
    <button class="${cls('card', dormant && 'is-dormant')}" data-a="openCheck" data-id="${esc(c.id)}">
      <div class="row-tap">
        <div class="list-main">
          <div class="spread">
            <span class="${cls('reg', dormant && 'is-dormant')}">${esc(c.reg)}</span>
            <span class="${cls('flag', flagMod)}">${esc(flag)}</span>
          </div>
          <div class="list-sub">${esc(dmy(dayOf(c.startedAt)) + ' · ' + c.inspectorName)}</div>
        </div>
        <span class="chev">${ICON.chev}</span>
      </div>
    </button>`;
}

/* The draw. This is what the screen is FOR — everything below it is the
   manager's countersign list, which is a different job on the same screen.

   It is deliberately one card with one primary button rather than a van
   picker: the moment there is a list to choose from, somebody chooses, and a
   spot-check chosen by the person being checked is not a spot-check. The whole
   apparatus of rules already in this app — exclusion window, forced threshold,
   re-rolls — existed to describe a draw that nothing ever performed. This
   performs it. */
function drawBlock() {
  const pool = drawPool();

  /* An empty hat is not an error and must not read as one. Either every active
     van is too freshly checked to come up (which fixes itself, and saying so is
     the whole point) or there are no active vans at all (which does not). */
  if (!pool.rows.length) {
    return `
      <div class="card">
        ${monoLabel('Nothing to draw')}
        ${note(pool.total
          ? 'Every active van was checked within the last ' + pool.excludeDays + ' days, so the hat is empty. It fills back up on its own as they age — or shorten the exclusion window in Settings.'
          : 'No van on the fleet is active. Off-road vans can’t be driven to be walked and retired ones aren’t the depot’s any more, so neither is ever drawn.', 'is-faint')}
        <button class="btn btn-quiet" data-a="openSettings">Draw settings</button>
      </div>`;
  }

  /* The standing draw has to be re-found in the pool on every render, not
     trusted from S: submitting the check resets that van's clock and drops it
     out of the hat, and a card still offering "start the check" on a van that
     was walked an hour ago would be lying. Gone from the pool = back to the
     button, with no cleanup step anywhere. */
  const row = pool.rows.filter(r => r.van.id === S.draw.vanId)[0] || null;

  if (!row) {
    return `
      <div class="card">
        ${monoLabel(pool.forced
          ? pool.rows.length + (pool.rows.length === 1 ? ' van is overdue' : ' vans are overdue')
          : pool.rows.length + ' of ' + pool.total + (pool.total === 1 ? ' van can be drawn' : ' vans can be drawn'))}
        ${note(pool.forced
          ? 'Anything past ' + pool.forceDays + ' days jumps the queue, so the draw comes from those alone until they are cleared.'
          : 'The app picks the van. Vans checked in the last ' + pool.excludeDays + ' days are held out so the same one can’t come up twice.', 'is-faint')}
        <button class="btn btn-primary btn-shadow" data-a="drawVan">Pick a van to check</button>
        <button class="btn btn-quiet" data-a="startCapture">Check a specific van instead</button>
      </div>`;
  }

  const f = drawFacts(row, pool);

  /* The rego IS the answer, so it is also the tap target: everything you might
     do INSTEAD of walking this van lives one tap behind it. That keeps the card
     to one sentence and one button — the thing you do nine times out of ten —
     without hiding the re-roll or the manual pick from anyone who wants them. */
  return `
    <div class="card is-selected">
      <button class="row-tap" data-a="openDraw" aria-label="${esc(f.v.reg + ' — roll again or pick manually')}">
        <div class="list-main">
          <div class="spread">
            <span class="reg">${esc(f.v.reg)}</span>
            <span class="${cls('flag', f.urgent ? 'is-red' : 'is-ink')}">${f.urgent ? 'OVERDUE' : 'DRAWN'}</span>
          </div>
          ${f.detail ? `<div class="mono-label">${esc(f.detail)}</div>` : ''}
          ${note(f.why, f.urgent ? 'is-red' : '')}
        </div>
        <span class="chev">${ICON.chev}</span>
      </button>
      <button class="btn is-wide btn-primary" data-a="drawStart">Start the check</button>
    </div>`;
}

/* What there is to say about a standing draw. Read by both the card on
   Vehicles Check and the draw's own screen — one van, one set of facts. */
function drawFacts(row, pool) {
  const v = row.van;
  const urgent = isForced(row, pool.forceDays);
  return {
    v, urgent,
    left: Math.max(0, drawRules().rerolls - S.draw.rolls),
    detail: [v.model, v.bay, v.motDue ? 'MOT ' + dmy(v.motDue) : ''].filter(Boolean).join(' · '),
    why: row.days === null
      ? 'Never been checked — that is why it came up.'
      : urgent
        ? 'Last checked ' + dmy(row.on) + ' — ' + row.days + ' days ago, past the ' + pool.forceDays + '-day limit.'
        : 'Last checked ' + dmy(row.on) + ' — ' + row.days + (row.days === 1 ? ' day ago.' : ' days ago.')
  };
}

/* The draw, on its own screen. Reached by tapping the drawn rego, and it exists
   for the two answers the card deliberately doesn't carry: roll again, or go
   pick the van yourself. Starting the check is still here — arriving at a
   screen that can only send you elsewhere is a dead end. */
function viewDraw() {
  const pool = drawPool();
  const row = pool.rows.filter(r => r.van.id === S.draw.vanId)[0] || null;

  /* Same rule the card lives by: a van that left the hat while this screen was
     open — walked, retired, put off the road — is not the draw any more, and
     offering to start a check on it would be a lie. */
  if (!row) {
    return emptyState('That draw is over',
      'The van that came up is no longer in the hat — it has been checked, retired or taken off the road since. Draw again from Vehicles Check.',
      { label: 'Back to Vehicles Check', action: 'back' });
  }

  const f = drawFacts(row, pool);
  return `
    <div class="card is-selected">
      <div class="spread">
        <span class="reg">${esc(f.v.reg)}</span>
        <span class="${cls('flag', f.urgent ? 'is-red' : 'is-ink')}">${f.urgent ? 'OVERDUE' : 'DRAWN'}</span>
      </div>
      ${f.detail ? `<div class="mono-label">${esc(f.detail)}</div>` : ''}
      ${note(f.why, f.urgent ? 'is-red' : '')}
      <button class="btn is-wide btn-primary btn-shadow" data-a="drawStart">Start the check</button>
    </div>
    <div class="divider-label">${monoLabel('Not this one?')}</div>
    <div class="card">
      ${note(f.left
        ? 'Rolling again draws a different van. ' + f.v.reg + ' goes back in the hat, and this draw has '
          + f.left + (f.left === 1 ? ' re-roll left.' : ' re-rolls left.')
        : 'Every re-roll on this draw is used up — change the limit in Settings if it is too tight.', 'is-faint')}
      ${f.left
        ? `<button class="btn btn-outline" data-a="drawVan">Roll again (${f.left})</button>`
        : '<button class="btn btn-disabled" data-a="noReroll">No re-rolls left</button>'}
      ${note('Picking manually is not a spot-check of the depot’s choosing — it is recorded the same way, but the van was chosen by a person.', 'is-faint')}
      <button class="btn btn-quiet" data-a="startCapture">Pick manually</button>
    </div>`;
}

function viewQueue() {
  /* The only setup problem this screen has, and the only thing that takes the
     whole screen: with no fleet there is nothing to draw from and nothing that
     could ever be submitted, so both halves below are equally empty. */
  if (!fleetList().length) {
    return emptyState('No fleet yet',
      'Nobody can spot-check a van the depot doesn’t know about. Add the fleet first.',
      { label: '+ Add a van', action: 'addFirstVan' });
  }

  const open = queueChecks();
  const flying = inFlightChecks();
  const draft = capDraftCard();
  const archived = historyChecks().length;

  const returnedCount = open.filter(c => c.decision === 'sent-back').length;

  const footnote = returnedCount
    ? returnedCount + (returnedCount === 1 ? ' check is' : ' checks are') + ' back with inspectors — they stay on this list until they’re resubmitted and signed.'
    : 'Countersigning is what finishes the record, raises the job and schedules the re-check.';

  const rows = open.map(c => checkRow(c)).join('');

  /* A check with no finish time is still open on someone's phone. Not yours to
     countersign — it lands here when they submit it. */
  const inFlight = flying.map(c => `
    <div class="card is-dashed-amber">
      <div class="spread">
        <span class="reg" style="color:var(--amber)">${esc(c.reg)}</span>
        <span class="flag is-amber">ON A PHONE</span>
      </div>
      <div class="mono-label is-amber">${esc('Started ' + hhmm(c.startedAt) + ' · ' + c.inspectorName)}</div>
      ${note('Not yours to countersign yet — it arrives when the phone finds signal.', 'is-faint')}
    </div>`).join('');

  const waiting = open.length || flying.length;

  /* Two jobs, in the order they are done: draw a van and walk it, then sign off
     what other people walked. A half-finished walk on this phone displaces the
     draw entirely — offering a new van beside a walk you abandoned mid-way is
     how the abandoned one never gets finished.

     The countersign half no longer takes over the screen when it is empty. It
     used to, because it was the only thing here; now an all-caught-up manager
     still has a van to draw, and a full-page "Queue clear" over the top of the
     one button that matters would be a celebration standing in the doorway. */
  return `
    ${draft}
    ${draft ? '' : drawBlock()}
    <div class="divider-label">${monoLabel('Awaiting your countersign' + (waiting ? ' — oldest first' : ''))}</div>
    ${waiting
      ? rows + inFlight + note(footnote, 'is-faint')
      : note(archived
          ? 'Nothing is waiting on your countersign. The ' + archived + ' you’ve already signed are in More → History.'
          : 'No checks have been submitted yet. One lands here the moment an inspector finishes theirs.', 'is-faint')}`;
}

/* --- Queue: one check --------------------------------------------------- */

/* Where the defect job is being sent, and by when. Both are picked on the
   countersign screen and written onto the defect when it is raised. Both are
   required: a job with nobody holding it and no date on it is not a job. */
/* Fix-by must be set AND not in the past. The date input's `min` only constrains
   the picker; a typed date can still be earlier, so the rule lives here too. */
const dueValid = () => !!(S.dueOn && S.dueOn >= Store.today());
const assignReady = () => !!(pickedShop() && dueValid());

/* The two required fields on a countersign. Rendered from a helper because the
   no-workshops case has to replace them entirely rather than show an empty
   picker the manager can't get out of. */
function assignFields() {
  const shops = workshopList();
  if (!shops.length) {
    return `
      <div class="card">
        ${monoLabel('Nowhere to send it')}
        ${note('A defect has to be assigned to a workshop, and this depot has none set up yet. Add one under More → Workshops, then countersign.', 'is-faint')}
        <!-- More, not a workshops screen: that screen is item 17. -->
        <button class="btn-add" data-a="tab" data-id="more">Go to More</button>
      </div>`;
  }

  const picked = pickedShop();
  return `
    <div class="field-row">
      <label class="${cls('field', !picked && 'is-required')}">
        <span class="field-label">Assign to *</span>
        <select class="${cls('field-select', !picked && 'is-empty')}" data-a="pickAssignee"
                data-fk="assign-shop" aria-label="Assign this job to a workshop">
          <option value=""${picked ? '' : ' selected'}>— pick a workshop —</option>
          ${shops.map(w => `<option value="${esc(w.id)}"${picked && picked.id === w.id ? ' selected' : ''}>${esc(w.name)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="field-row">
      <label class="${cls('field', !dueValid() && 'is-required')}">
        <span class="field-label">Fix by *</span>
        <input class="${cls('field-input', !S.dueOn && 'is-empty')}" data-a="pickDue" data-fk="assign-due"
               value="${esc(S.dueOn)}" type="date" min="${esc(Store.today())}" max="2099-12-31"
               aria-label="Date the repair is due by">
        ${S.dueOn && S.dueOn < Store.today() ? note('Fix-by can’t be in the past.', 'is-red') : ''}
      </label>
    </div>`;
}

function viewCheck() {
  const sel = selectedCheck();
  if (!sel) return `<div class="empty">${monoLabel('No check open')}${note('Pick a check from the countersign list on Vehicles Check.', 'is-faint')}</div>`;

  const decided = sel.decision;
  const fails = failedResults(sel);
  const hasDefect = !!fails.length;
  /* A countersign now needs four things: somebody signed in as a manager, a
     workshop + date if anything failed, and that manager's drawn signature. The
     signature only gates a check that is still open — a decided one is already
     signed. */
  const canApprove = isManager() && (!hasDefect || assignReady()) && (!!decided || sigReady());

  /* The evidence strip, for real now. A shot that was taken is a tappable
     thumbnail (tap to judge it full-screen); one that wasn't stays an empty
     tile — which honestly reads as "not photographed", not as a broken image.
     N/S carries the flag when this check raised a defect, as it always has. */
  const photos = sel.photos || {};
  const shots = SHOTS.map(l => {
    const flagged = hasDefect && l === 'N/S';
    const id = photos[l];
    return id
      ? `<button class="${cls('shot', 'has-img', flagged && 'is-flagged')}" data-a="viewPhoto" data-photo-id="${esc(id)}" aria-label="${esc(shotLabel(l) + ' photo — tap to enlarge')}"><img data-photo-id="${esc(id)}" alt="${esc(shotLabel(l))}"><span class="shot-tag">${esc(shotLabel(l))}</span></button>`
      : `<div class="${cls('shot', 'is-empty', flagged && 'is-flagged')}"><span class="shot-tag">${esc(shotLabel(l))}</span></div>`;
  }).join('');

  let out = `
    <div class="stack-sm">
      <div class="spread"><span style="font:600 21px/1.2 var(--sans)">${esc(sel.reg)} — ${esc(dmy(dayOf(sel.startedAt)))}</span></div>
      <div class="mono-label">${esc(crewLine(sel))}</div>
    </div>
    <div class="evidence">${shots}</div>
    <div class="stats">
      ${stat(sel.passed, 'Passed')}
      ${stat(sel.failed, 'Failed', !!sel.failed)}
      ${stat(sel.mileage == null ? '—' : sel.mileage.toLocaleString('en-GB'), 'Odometer')}
    </div>`;

  if (hasDefect) {
    out += monoLabel(fails.length === 1 ? '1 job to raise' : fails.length + ' jobs to raise', 'is-red');
    out += fails.map(res => {
      const defectMeta = sentence(res.severity || 'minor')
        + ' · Safe to drive: ' + (res.safeToDrive === false ? 'no' : 'yes');
      return `
      <div class="card is-red">
        <div class="spread">
          <div style="font:500 17px/1.3 var(--sans)">${esc(res.name)}</div>
          ${res.sectionName ? `<span class="flag is-red">${esc(res.sectionName)}</span>` : ''}
        </div>
        <div class="mono-label is-red">${esc(defectMeta)}</div>
        ${note(res.note)}
      </div>`;
    }).join('');
    /* One workshop and one date for the whole check: it is one van going to
       one place on one day. Splitting a check across workshops is a real
       thing but a rare one — it wants its own screen, not a picker per row. */
    out += `
      ${fails.length > 1 ? note('All ' + fails.length + ' jobs go to the same workshop, due the same day — it is one van making one visit.', 'is-faint') : ''}
      ${assignFields()}
      <button class="check-row" data-a="toggleOffRoad" aria-pressed="${S.offRoad}">
        <span class="${cls('box', S.offRoad && 'is-on')}">${S.offRoad ? ICON.tick : ''}</span>
        <span>Take van off road until fixed</span>
      </button>`;
  }

  if (S.sendingBack) {
    out += viewSendBack(sel);
  } else if (decided === 'sent-back') {
    out += `
      <div class="card is-red">
        <div class="mono-label is-red">${esc('Sent back ' + hhmm(sel.decidedAt) + ' · on ' + sel.inspectorName + '’s phone now')}</div>
        <div style="font:400 16px/1.4 var(--sans);text-wrap:pretty">“${esc(sel.returnNote)}”</div>
        <div class="mono-label">${esc(sel.returnScope === 1 ? 'Whole check reopened' : 'Flagged part only')} · ${esc(sel.reg + (sel.returnHold ? ' held out of the draw' : ' back in the draw'))}</div>
        ${note('Nothing is countersigned. ' + sel.inspectorName + ' gets it back at the top of their phone, with that line on it. The record stays open until they resubmit and you sign it — and it shows as overdue if it sits past tomorrow.')}
      </div>
      <div class="dock">
        <div class="dock-row">
          <button class="btn btn-outline" data-a="sendBack">Take it back into my queue</button>
        </div>
      </div>`;
  } else {
    const csDone = decided === 'countersigned';
    const csLine = csDone ? esc(sel.decidedBy || 'Unknown') + ' · ' + esc(dmy(dayOf(sel.decidedAt)) + ' ' + hhmm(sel.decidedAt)) : '';

    /* Nobody signed in — or an inspector signed in — cannot put a name to this.
       Say so here, with the way out, rather than leaving a dead button at the
       bottom of a long screen and no explanation of why. */
    if (!decided && !isManager()) {
      const p = me();
      out += `
        <div class="card is-dashed-amber">
          <div class="mono-label is-amber">${p ? esc('Signed in as ' + p.name + ' — inspector') : 'Not signed in'}</div>
          ${note(p
            ? 'Inspectors check vans; countersigning is a manager’s signature on someone else’s work. Switch to a manager to sign this one off.'
            : 'A countersignature has to carry a name. Choose who you are before signing anything off.')}
          <button class="btn btn-outline" data-a="openWho">${p ? 'Switch person' : 'Choose who you are'}</button>
        </div>`;
    }

    /* A manager is allowed to countersign a van they walked themselves — a depot
       with one manager would otherwise never be able to close a record, and a
       stuck record is worse than a self-signed one. But it is NOT a second pair
       of eyes, and the copy must not pretend otherwise: saying "you're putting
       your name to Tien Nguyen's work" to Tien Nguyen reads as a bug and quietly
       dresses a self-signature up as a check. Named plainly instead. */
    const meNow = me();
    const selfSign = !!meNow && meNow.id === sel.inspectorId;
    /* "If another manager is about" is a generality, and generalities are easy to
       skip past. Name them and the nudge has somewhere to go — or say plainly that
       there is nobody else, which turns the warning from a reproach into a fact.
       Only worth computing while the decision is still open. */
    const alts = selfSign && !csDone ? nameList(otherManagers().map(p => p.name)) : '';

    out += `
      <div class="${cls('card', csDone ? 'is-dashed-grey' : 'is-dashed-amber')}">
        <div class="${cls('mono-label', csDone ? '' : 'is-amber')}">${csDone
          ? 'Countersigned by ' + csLine
          : selfSign
            ? 'Your own walk · awaiting your countersign'
            : 'Signed by ' + esc(sel.inspectorName) + ' · awaiting your countersign'}</div>
        ${csDone && sel.signatureId
          ? `<div class="sig-frame is-signed"><img class="sig-img" data-photo-id="${esc(sel.signatureId)}" alt="Countersignature"></div>`
          : ''}
        ${note(csDone
          ? (sel.decidedBy === sel.inspectorName
              ? 'You walked this van and countersigned it yourself, and the record says so. It stands, but it was never seen by a second person.'
              : 'Your name is on this record beside ' + sel.inspectorName + '’s. It’s a finished document now — changes need a new check.')
          : selfSign
            ? 'This is your own walk. Countersigning it closes the record on your signature alone — no second pair of eyes, and the record will say so. ' + (alts
                ? alts + ' could countersign it instead, and it is worth the ask.'
                : 'You are the only manager on the books, so this is the only way to close it.')
            : 'You’re putting your name to ' + sel.inspectorName + '’s work: the photos, the readings, the defect call. Send it back if you can’t stand behind it.',
          selfSign && !csDone ? 'is-red' : undefined)}
      </div>`;

    /* The sign-off pad. Only while the check is still open AND there is a
       manager to sign — an unsigned-in phone drawing a signature would be
       collecting ink with no name to attach it to. */
    if (!decided && isManager()) {
      out += `
        <div class="card">
          <div class="spread">
            <span class="mono-label">Sign to countersign</span>
            ${sigReady() ? '<button class="sig-clear" data-a="clearSig">Clear</button>' : ''}
          </div>
          <div class="sig-frame">
            <canvas class="sig-pad" data-check="${esc(sel.id)}"></canvas>
            ${sigReady() ? '' : '<span class="sig-hint">Sign here with your finger</span>'}
          </div>
        </div>`;
    }

    const approveLabel = csDone ? 'Countersigned — ' + (sel.decidedBy || 'Unknown') + ' ' + hhmm(sel.decidedAt)
      : !isManager() ? (me() ? 'Only a manager can countersign' : 'Sign in to countersign')
      : (hasDefect && !assignReady()) ? 'Assign + due date required'
      : !sigReady() ? 'Sign above to countersign'
      : hasDefect ? 'Countersign & raise ' + (fails.length === 1 ? 'job' : fails.length + ' jobs')
      : 'Countersign this check';

    out += `
      <div class="dock">
        <div class="dock-row">
          <button class="${cls('btn', (csDone || !isManager()) ? 'btn-disabled' : 'btn-outline')}" data-a="sendBack" ${(csDone || !isManager()) ? 'disabled' : ''}>${csDone ? 'Countersigned' : 'Send back'}</button>
          <button class="${cls('btn', 'is-wide', csDone ? 'btn-done' : (canApprove ? 'btn-primary' : 'btn-disabled'))}" data-a="approve" ${(decided || !canApprove) ? 'disabled' : ''}>${esc(approveLabel)}</button>
        </div>
      </div>`;
  }
  return out;
}

function viewSendBack(sel) {
  const canSend = S.sbReason !== null && (S.sbReason !== 5 || S.sbNote.trim().length > 2);

  const reasons = REASONS.map((label, i) => {
    const on = S.sbReason === i;
    return `<button class="check-row" data-a="sbReason" data-i="${i}" aria-pressed="${on}"
        style="${on ? 'border:2px solid var(--red);background:var(--red-wash);padding:9px 11px' : ''}">
      <span class="box ${on ? 'is-on' : ''}" style="${on ? 'background:var(--red);border-color:var(--red)' : ''}">${on ? ICON.tick : ''}</span>
      <span style="${on ? '' : 'color:var(--body)'}">${esc(label)}</span>
    </button>`;
  }).join('');

  const scopes = SCOPES.map((label, i) => {
    const on = S.sbScope === i;
    return `<button class="btn ${on ? 'btn-outline' : 'btn-quiet'}" data-a="sbScope" data-i="${i}"
      style="flex:1 1 100%;${on ? 'border-width:2px;background:#F2F4F6' : ''}">${esc(label)}</button>`;
  }).join('');

  const consequence = (S.sbScope === 0
    ? 'Only the flagged part reopens — the rest of what ' + sel.inspectorName + ' signed stays as it is. '
    : 'Every item and photo gets done again. Their first attempt stays on file, marked superseded. ')
    + (S.sbHold
      ? sel.reg + ' stays out of the draw, so nobody else gets sent to it.'
      : sel.reg + ' goes back in the draw tonight — someone else could be sent to the same van.');

  return `
    <div class="card is-red-strong">
      <div class="mono-label is-red">Sending back to ${esc(sel.inspectorName)} — give them the reason *</div>
      <div class="stack-sm">${reasons}</div>
      ${S.sbReason === 5
        ? `<textarea class="textarea" data-a="sbNote" data-fk="sbNote" placeholder="Tell them what to put right — they only see this line.">${esc(S.sbNote)}</textarea>`
        : ''}
      ${monoLabel('How much do they redo?')}
      <div class="dock-row" style="flex-wrap:wrap">${scopes}</div>
      <button class="check-row" data-a="sbToggleHold" aria-pressed="${S.sbHold}">
        <span class="${cls('box', S.sbHold && 'is-on')}">${S.sbHold ? ICON.tick : ''}</span>
        <span>Keep ${esc(sel.reg)} out of the draw until it comes back</span>
      </button>
      ${note(consequence, 'is-faint')}
    </div>
    <div class="dock">
      <div class="dock-row">
        <button class="btn btn-quiet" data-a="sbCancel">Cancel</button>
        <button class="btn is-wide ${canSend ? 'btn-danger' : 'btn-disabled'}" data-a="sbConfirm" ${canSend ? '' : 'disabled'}>${canSend ? 'Send back to ' + esc(sel.inspectorName) : 'Pick a reason first'}</button>
      </div>
    </div>`;
}

/* --- History ------------------------------------------------------------ */

/* The archive the queue used to be. Once countersigned, a check is a finished
   document and leaves the queue so the queue can stay a to-do list; it lands
   here instead, newest signature first, and opens read-only. */
function viewHistory() {
  const rows = historyChecks();
  if (!rows.length) {
    return emptyState('No history yet',
      'Every check you countersign is filed here as a permanent record, newest first. Nothing has been countersigned yet.');
  }
  return `
    ${monoLabel(rows.length + (rows.length === 1 ? ' countersigned check' : ' countersigned checks') + ' — newest first')}
    ${rows.map(c => checkRow(c, false)).join('')}
    ${note('A countersigned check is a finished document. Open one to read the signed record — changes need a new check.', 'is-faint')}`;
}

/* --- Defects ------------------------------------------------------------ */

function viewDefects() {
  const list = openDefects();
  if (!list.length) {
    // "All closed" and "none ever raised" look identical on screen and mean
    // completely different things to a manager. Keep them apart.
    return doneChecks().length
      ? emptyState('No open defects', 'Every raised defect has been repaired, re-checked and closed.')
      : emptyState('No defects yet',
          'A defect is raised when you countersign a check that failed something. Nothing has been countersigned yet.');
  }
  const cards = list.map(d => {
    const stage = defectStage(d);
    const mod = stage === 'overdue' ? 'is-red' : stage === 'verified' ? 'is-ink' : 'is-faint';
    const verified = stage === 'verified';
    const sev = d.severity || 'minor';
    return `
      <div class="${cls('card', stage === 'overdue' && 'is-red')}">
        <div class="spread">
          <span class="reg">${esc(d.reg)} — ${esc(d.name)}</span>
          <span class="${cls('flag', mod)}">${esc(stage === 'overdue' ? 'Overdue · ' + sev : sentence(sev))}</span>
        </div>
        <div class="row-tap" style="align-items:flex-start">
          <div class="${cls('thumb-sm', stage === 'overdue' && 'is-red')}"></div>
          <div class="list-main">
            ${note(d.note)}
            <div class="list-sub">${esc(defectMetaLine(d))}</div>
          </div>
        </div>
        <button class="btn ${verified ? 'btn-outline' : 'btn-outline-red'}" data-a="defectAction" data-id="${d.id}">${verified ? 'Close defect — repair verified' : 'Chase / schedule re-check'}</button>
      </div>`;
  }).join('');

  return cards + note('A defect only closes when someone re-checks the van and photographs the repair.', 'is-faint');
}

/* --- Coverage ----------------------------------------------------------- */

function viewCoverage() {
  /* Coverage is entirely a statement about the fleet. With no fleet there is
     nothing true to say, so don't draw an empty grid and four dead rules. */
  if (!fleetList().length) {
    return emptyState('Nothing to cover yet',
      'Coverage tracks how long it has been since each van was last checked. Add the fleet and this fills itself in.',
      { label: '+ Add a van', action: 'addFirstVan' });
  }

  const rows = coverageRows();
  /* A fleet that is entirely retired is not an empty depot and not a covered
     one — it is a depot with nothing left to walk, and saying so is better
     than a grid with no cells in it. */
  if (!rows.length) {
    return emptyState('Nothing left to cover',
      'Every van on the fleet is retired. Retired vans keep their history but are never drawn, so there is nothing for coverage to measure.',
      { label: 'Open the fleet', action: 'tab', id: 'vans' });
  }

  const { excludeDays, forceDays, rerolls, targetPerWeek } = drawRules();

  /* Walked, not countersigned: this counts the work the depot did this week,
     which is not the same question as what the manager has got through. */
  const weekAgo = shiftDays(Store.today(), -7);
  const doneThisWeek = doneChecks().filter(c => dayOf(c.finishedAt) > weekAgo).length;

  const seen = rows.filter(r => r.days !== null);
  const never = rows.length - seen.length;
  /* Averaging a "never" as any number would be a lie in whichever direction
     it was picked, so the average is over walked vans and the never-walked
     ones are counted separately, in the open. */
  const avg = seen.length ? Math.round(seen.reduce((a, r) => a + r.days, 0) / seen.length) + 'd' : '—';
  const forced = rows.filter(r => isForced(r, forceDays)).length;
  const eligible = rows.filter(r => isEligible(r, excludeDays)).length;

  const cells = rows.map(r => {
    const mod = isForced(r, forceDays) ? 'is-overdue' : (r.days > excludeDays ? '' : 'is-excluded');
    const label = r.days === null ? 'New' : r.days + 'd';
    const title = r.van.reg + ' — ' + (r.on ? 'last checked ' + dmy(r.on) : 'never checked');
    return `<button class="${cls('van-cell', mod, r.days === null && 'is-never')}"
      data-a="openVan" data-id="${esc(r.van.id)}" title="${esc(title)}" aria-label="${esc(title)}">${esc(label)}</button>`;
  }).join('');

  const pace = eligible
    ? eligible + ' of ' + rows.length + ' vans can be drawn right now. At ' + targetPerWeek +
      ' checks a week every van gets seen roughly every ' +
      Math.max(1, Math.round(rows.length / targetPerWeek)) + ' weeks.'
    : 'No van can be drawn right now — every one of them was checked within the last ' +
      excludeDays + ' days. The draw comes back on its own as they age.';

  return `
    <div class="stats">
      ${stat(doneThisWeek, 'Done this week')}
      ${stat(avg, 'Avg since last')}
      ${stat(forced, 'Past ' + forceDays + ' days', !!forced)}
    </div>
    ${monoLabel('Every van — days since last check, oldest first')}
    <div class="van-grid">${cells}</div>
    ${note('Outlined red = past ' + forceDays + ' days and forced into the next draw. Grey = checked recently, excluded. NEW = never checked at all. Tap a van to open it.', 'is-faint')}
    ${never ? note(never === 1
      ? '1 van has never been checked. It counts as overdue, not as new.'
      : never + ' vans have never been checked. They count as overdue, not as new.', 'is-red') : ''}
    <div class="divider-label">${monoLabel('Draw rules')}</div>
    ${note('Held out for ' + excludeDays + (excludeDays === 1 ? ' day' : ' days') + ' after a check · forced past ' +
      forceDays + ' days · ' + rerolls + (rerolls === 1 ? ' re-roll' : ' re-rolls') + ' per draw · aiming for ' +
      targetPerWeek + ' checks a week.', 'is-faint')}
    <button class="btn btn-quiet" data-a="openSettings">Change the draw rules</button>
    <div class="card">${note(pace)}</div>
    <button class="btn btn-quiet" data-a="exportWeek">Export this week (CSV)</button>`;
}

/* --- Vans: list --------------------------------------------------------- */

function viewVans() {
  const fleet = fleetList();

  /* An empty fleet is not "no results" — the filter chip and the count would
     both be noise here. One instruction and one button instead. */
  if (!fleet.length) {
    return emptyState('No vans yet',
      'This is the list the draw picks from. Add each van once — reg, model, bay and MOT date.',
      { label: '+ Add a van', action: 'startAdd' });
  }

  const filter = FILTERS[S.filterIdx];
  const shown = fleet.filter(v => filter === 'All'
    || (filter === 'Active only' && v.status === 'active')
    || (filter === 'Off road' && v.status === 'offroad')
    || (filter === 'Retired' && v.status === 'retired'));

  const rows = shown.map(v => {
    const [label, tone] = STATUS_META[v.status];
    return `
      <button class="${cls('card', v.status === 'retired' && 'is-dormant')}" data-a="openVan" data-id="${esc(v.id)}">
        <div class="row-tap">
          <div class="list-main">
            <div class="spread">
              <span class="${cls('reg', v.status === 'retired' && 'is-dormant')}">${esc(v.reg)}</span>
              <span class="flag is-${tone}">${esc(label)}</span>
            </div>
            <div class="list-sub">${esc((v.model || 'Model not set') + ' · last ' + (dmy(v.lastCheckOn) || 'never'))}</div>
          </div>
          <span class="chev">${ICON.chev}</span>
        </div>
      </button>`;
  }).join('');

  return `
    <div class="divider-label">
      ${monoLabel(shown.length + ' shown · ' + fleet.filter(v => v.status === 'active').length + ' in the draw')}
      <button class="chip is-ghost" data-a="cycleFilter">${esc(filter)}</button>
    </div>
    <button class="btn-add" data-a="startAdd">+ Add a van</button>
    ${rows || `<div class="empty">${note('No vans match this filter.', 'is-faint')}</div>`}`;
}

/* --- Vans: one van ------------------------------------------------------ */

/* Every spot-check ever recorded on this van, newest first — countersigned,
   sent back or still awaiting a signature. The van screen used to show a status
   and an MOT date and nothing about what had actually been walked; this is
   where the van's own record lives. Tapping a row opens that check read-only. */
function vanHistoryBlock(vanId) {
  const rows = doneChecks().filter(c => c.vanId === vanId);
  if (!rows.length) {
    return `
      <div class="divider-label">${monoLabel('Check history')}</div>
      ${note('No spot-checks recorded on this van yet.', 'is-faint')}`;
  }
  return `
    <div class="divider-label">${monoLabel(rows.length + (rows.length === 1 ? ' check on record' : ' checks on record') + ' — newest first')}</div>
    ${rows.map(c => checkRow(c, false)).join('')}`;
}

function viewVan() {
  const draft = S.draft;
  // Whitespace is not a registration — the save button must not arm on a space.
  const draftNamed = !!draft.reg.trim();
  const savedVan = draft.id ? Store.get('vans', draft.id) : null;

  const statusBtns = ['active', 'offroad', 'retired'].map(s => {
    const on = draft.status === s;
    const [label, tone] = STATUS_META[s];
    const color = tone === 'red' ? 'var(--red)' : tone === 'faint' ? '#999' : 'var(--ink)';
    return `<button class="btn" data-a="setStatus" data-id="${s}"
      style="flex:1 1 0;min-width:0;border:1.5px solid ${color};${on ? `background:${color};color:#fff` : `color:${color};background:transparent`}">${esc(label)}</button>`;
  }).join('');

  const statusNote = draft.status === 'active'
    ? 'Eligible for the random draw and counted in coverage.'
    : draft.status === 'offroad'
      ? 'Held out of the draw. Anyone opening it sees the off-road banner.'
      : 'Kept for history only — never drawn, hidden from coverage.';

  const detailNote = draft.bay && draft.motDue
    ? 'Bay and MOT show on the inspector’s draw screen, so they know where to walk and what’s coming up.'
    : 'Bay and MOT are optional, but without them the inspector’s draw screen can’t say where the van is parked.';

  return `
    <div class="stack-sm">
      <div style="font:600 21px/1.2 var(--sans)">${esc(S.adding ? 'New van' : (draft.reg || '—'))}</div>
      <div class="mono-label">${esc(S.adding ? 'It joins the draw as soon as it’s saved' : (savedVan ? 'On the fleet · ' + STATUS_META[savedVan.status][0] : ''))}</div>
    </div>

    <div class="field-row">
      <label class="${cls('field', !draftNamed && 'is-required')}">
        <span class="field-label">Registration *</span>
        <input class="field-input" data-a="editReg" data-fk="van-reg" value="${esc(draft.reg)}"
               type="text" autocapitalize="characters" autocorrect="off" spellcheck="false"
               maxlength="10" placeholder="e.g. KX21 HVD" aria-label="Registration">
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Make / model</span>
        <input class="field-input" data-a="editModel" data-fk="van-model" value="${esc(draft.model)}"
               type="text" list="van-models" maxlength="40" placeholder="e.g. Ford Transit Custom"
               aria-label="Make and model">
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Parking bay</span>
        <input class="field-input" data-a="editBay" data-fk="van-bay" value="${esc(draft.bay)}"
               type="text" maxlength="16" placeholder="e.g. Bay 7" aria-label="Parking bay">
      </label>
      <label class="field">
        <span class="field-label">MOT due</span>
        <input class="${cls('field-input', !draft.motDue && 'is-empty')}" data-a="editMot" data-fk="van-mot"
               value="${esc(draft.motDue)}" type="date" min="2000-01-01" max="2099-12-31"
               aria-label="MOT due date">
      </label>
    </div>
    <!-- Suggestions, not a fixed list: a depot can run anything with wheels. -->
    <datalist id="van-models">${MODELS.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist>
    ${note(detailNote, 'is-faint')}

    <div class="divider-label">${monoLabel('Status — decides if it can be drawn')}</div>
    <div class="dock-row">${statusBtns}</div>
    <div class="card">${note(statusNote)}</div>

    <div class="stats">
      ${stat(savedVan ? (dmy(savedVan.lastCheckOn) || 'never') : '—', 'Last checked')}
      ${stat(savedVan ? vanDefectCount(savedVan.id) : 0, 'Open defects', !!(savedVan && vanDefectCount(savedVan.id)))}
    </div>

    ${note('Retiring a van keeps its history and past checks — it just stops being drawn.', 'is-faint')}

    ${savedVan ? vanDeleteBlock(savedVan) : ''}

    ${savedVan ? vanHistoryBlock(savedVan.id) : ''}

    <div class="dock">
      <div class="dock-row">
        <button class="btn btn-quiet" data-a="cancelVan">${S.adding ? 'Cancel' : 'Revert'}</button>
        <button class="btn is-wide ${draftNamed ? 'btn-primary btn-shadow' : 'btn-disabled'}" data-a="saveVan" ${draftNamed ? '' : 'disabled'}>${draftNamed ? (S.adding ? 'Add to the fleet' : 'Save changes') : 'Registration required'}</button>
      </div>
    </div>`;
}

/*
   Deleting a van, and the one rule that governs it.

   A van with history CANNOT be deleted — only retired. Its checks and defects
   point at it by id, and coverage counts it; removing the van would leave a
   trail of records about a vehicle the depot has no record of. Retire already
   does the real job (out of the draw, out of coverage, history intact), so
   delete exists for exactly one case: the van typed in by mistake, which by
   definition has never been walked.

   That is the user's own ask — "if accident add can't del" — answered without
   giving anybody a one-tap way to shred a year of inspections.
*/
function vanDeleteBlock(van) {
  const checks = Store.count('checks', c => c.vanId === van.id);
  const defects = Store.count('defects', d => d.vanId === van.id);
  const armed = S.armDelVan === van.id;

  if (checks || defects) {
    const bits = [];
    if (checks) bits.push(checks + (checks === 1 ? ' check' : ' checks'));
    if (defects) bits.push(defects + (defects === 1 ? ' defect' : ' defects'));
    return `
      <div class="divider-label">${monoLabel('Remove from the fleet')}</div>
      <div class="card">${note(van.reg + ' has ' + bits.join(' and ') + ' against it, so it can’t be deleted — those records would be about a van that no longer exists. Set it to Retired instead: it stops being drawn and drops out of coverage, and every past check stays readable.')}</div>`;
  }

  return `
    <div class="divider-label">${monoLabel('Remove from the fleet')}</div>
    <button class="${cls('btn', armed ? 'btn-danger' : 'btn-quiet')}" data-a="delVan">${armed ? 'Tap again to delete ' + esc(van.reg) : 'Delete this van'}</button>
    ${note(armed
      ? 'This removes ' + van.reg + ' from the depot for good. It has never been checked, so nothing else goes with it. Tap anything else to cancel.'
      : 'Only possible because ' + van.reg + ' has never been checked. Once it has been walked once, retiring is the only way off the fleet.',
      armed ? 'is-red' : 'is-faint')}`;
}

/* --- Backup file -------------------------------------------------------- */
/*
   There is no server and no sync, so this file is the only copy of a depot that
   exists anywhere off the phone — and the only way to carry one to a hosted
   version, because localStorage is keyed by origin and https://… opens empty.

   Shape: the store's own database, wrapped in an envelope that says what the
   file is. The wrapper is what makes a stray .json identifiable before it is
   allowed to overwrite a depot, and it keeps `exportedAt` out of the database
   itself — anything sitting beside `schema` gets carried into storage by
   migrate() and lives there for good.
*/
const BACKUP_APP = 'fleet-spot-check';

/* The parsed database of a picked backup, held here rather than in S. One-shot:
   restoring or cancelling clears it, and it must never survive a reload. */
let pendingImport = null;

/* One reused <input type="file">. Built in JS rather than rendered into the
   markup because a file input reports its choice as a `change` event, and
   handle() routes only `input` events to field elements — a delegated one would
   never fire. Reusing it also stops cancelled picks piling up in the DOM. */
let filePicker = null;

function backupCounts(db) {
  return {
    vans: db.vans.length,
    checks: db.checks.length,
    defects: db.defects.length,
    people: db.people.length,
    workshops: db.workshops.length,
    sections: db.checklist.length
  };
}

/* Liberal in what it accepts — a bare Store.export() database restores as
   happily as a wrapped one, because a backup that will not go back in is not a
   backup. Strict about what it then trusts: Store.import() runs the file
   through migrate(), which fills in whatever is missing, so `{}` would sail
   through and silently empty the depot. The collection check below is what
   stops that. */
function readBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { return { error: 'That file isn’t JSON. Pick the .json backup this app saved.' }; }
  if (!parsed || typeof parsed !== 'object') return { error: 'That file isn’t a depot backup.' };

  const db = parsed.db && typeof parsed.db === 'object' ? parsed.db : parsed;
  if (typeof db.schema !== 'number') return { error: 'That file isn’t a depot backup — no schema in it.' };
  /* Migrations only run forward. A file from a newer version would be loaded
     with its extra shape quietly discarded, which is worse than refusing. */
  if (db.schema > Store.SCHEMA) {
    return { error: 'That backup was made by a newer version of the app (schema ' + db.schema + '). Update first.' };
  }
  const missing = Store.COLLECTIONS.filter(c => !Array.isArray(db[c]));
  if (missing.length) return { error: 'That file is missing ' + missing.join(', ') + ' — it isn’t a depot backup.' };

  return { db, exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '' };
}

/* --- More menu ---------------------------------------------------------- */

function viewMore() {
  const live = liveCount();
  const dirty = isDirty();
  const activePeople = Store.count('people', p => p.active && p.role !== 'admin');
  const activeShops = workshopList().length;
  const signed = historyChecks().length;
  /* No workshop is not a cosmetic gap — it blocks every countersign, so it is
     called out in red on the row rather than discovered on a failed check. */
  const shopSub = activeShops
    ? activeShops + ' taking work · ' + openDefects().length + ' open'
    : 'None yet — defects can’t be assigned';
  /* Coverage lost its tab, so its one alarming number has to survive the move:
     a menu row nobody opens is worse than no row at all. `isForced` already
     folds never-checked vans in with the overdue ones, which is the right
     reading — a van nobody has ever walked is not "0 days ago". */
  const covRows = coverageRows();
  const covForced = covRows.filter(r => isForced(r, drawRules().forceDays)).length;
  const covSub = !covRows.length
    ? 'No vans to cover yet'
    : covForced
      ? covForced + (covForced === 1 ? ' van' : ' vans') + ' past ' + drawRules().forceDays + ' days'
      : covRows.length + (covRows.length === 1 ? ' van · longest ' : ' vans · longest ') + covRows[0].days + 'd';

  const item = (action, icon, title, sub, subMod) => `
    <button class="menu-item" data-a="${action}">
      <span style="color:var(--ink);display:flex">${ICON[icon]}</span>
      <span class="list-main">
        <span class="list-title">${esc(title)}</span>
        <span class="${cls('list-sub', subMod)}">${esc(sub)}</span>
      </span>
      <span class="chev">${ICON.chev}</span>
    </button>`;

  /* The depot's name lost the home-screen header when that screen was renamed
     for the job it does. It lands here rather than nowhere: More is where the
     depot is set up — its checklist, its people, its garages — so its name
     belongs at the head of that, and a depot with no name yet simply reads as
     it always did. */
  return `
    ${monoLabel(depotName() ? depotName() + ' · depot setup' : 'Depot setup')}
    ${item('openChecklist', 'list', 'Checklist',
      dirty ? changeCount() + ' change' + (changeCount() === 1 ? '' : 's') + ' not yet live'
            : live + ' checks live · v' + checklistVersion(), dirty ? 'is-red' : '')}
    ${item('openPeople', 'people', 'People', activePeople + ' active · 2 roles')}
    ${item('openWorkshops', 'workshop', 'Workshops', shopSub, activeShops ? '' : 'is-red')}
    <div class="card">${note('One depot, two roles: inspectors check vans, managers countersign. Everyone here sees the same fleet.')}</div>
    <div class="divider-label">${monoLabel('Records')}</div>
    ${item('openHistory', 'queue', 'History',
      signed ? signed + ' countersigned · newest first' : 'Nothing countersigned yet')}
    <div class="divider-label">${monoLabel('Device')}</div>
    ${item('openSettings', 'settings', 'Settings', 'Backup, restore and reset this depot')}
    <div class="divider-label">${monoLabel('Fleet')}</div>
    ${item('openCoverage', 'coverage', 'Coverage', covSub, covForced ? 'is-red' : '')}`;
}

/* --- Settings ----------------------------------------------------------- */

/* The plumbing that used to sit at the bottom of More: a whole-depot backup and
   the two destructive buttons. It is deliberately one screen back from the
   working menus — this is where the depot is saved, replaced or wiped, not
   where daily work happens. */
/* Each rule is a number the depot chooses, so it is typed, not cycled — and
   typed as text with a numeric keypad, because a number input reports '' the
   moment the field is being cleared and the re-render would eat the digit.

   It sat inside Coverage until the draw became a real thing you press. Coverage
   is a report — how the fleet is doing — and the rules are a setting; keeping
   them there meant the only way to change how vans are picked was to go read a
   grid about it first. */
function ruleField(r) {
  const drafting = Object.prototype.hasOwnProperty.call(S.ruleDraft, r.key);
  const value = drafting ? S.ruleDraft[r.key] : String(drawRules()[r.key]);
  return `
    <label class="${cls('field', drafting && 'is-required')}">
      <span class="field-label">${esc(r.label + (r.unit ? ' (' + r.unit + ')' : ''))}</span>
      <input class="field-input" data-a="editRule" data-id="${esc(r.key)}" data-fk="rule-${esc(r.key)}"
             value="${esc(value)}" type="text" inputmode="numeric" maxlength="3"
             aria-label="${esc(r.label)}">
    </label>`;
}

function viewSettings() {
  const name = depotName();
  const badDraft = RULES.filter(r => Object.prototype.hasOwnProperty.call(S.ruleDraft, r.key));
  const { excludeDays, forceDays } = drawRules();
  return `
    ${monoLabel('This depot')}
    <div class="field-row">
      <label class="field">
        <span class="field-label">Depot name</span>
        <input class="field-input" data-a="editDepotName" data-fk="depot-name"
               value="${esc(Store.settings().depotName)}" type="text" maxlength="40"
               placeholder="e.g. Barking depot" aria-label="Depot name">
      </label>
    </div>
    ${note(name
      ? 'This is the name at the head of More, and it rides along in every backup. One install is one depot — the vans on it park here, in the bays you give them; the workshops in More are the outside garages that repair them.'
      : 'Give this depot the name people say out loud — a site, a yard, a base. It shows at the head of More and rides along in every backup. Until then the app says nothing rather than guess.',
      'is-faint')}
    <div class="divider-label">${monoLabel('Picking a van to check')}</div>
    <div class="field-row">${ruleField(RULES[0])}${ruleField(RULES[1])}</div>
    <div class="field-row">${ruleField(RULES[2])}${ruleField(RULES[3])}</div>
    ${badDraft.length
      ? note('Not saved yet — ' + badDraft.map(r => r.label.toLowerCase() + ' must be ' + r.min + '–' + r.max).join(', ') + '. The rule in force is unchanged until it is.', 'is-red')
      : note('These decide what Vehicles Check can draw. A van is held out of the hat for ' + excludeDays +
          (excludeDays === 1 ? ' day' : ' days') + ' after it is walked, and any van past ' + forceDays +
          ' days jumps ahead of everything else until somebody walks it. They apply to every phone in the depot, not just this one.', 'is-faint')}
    <div class="divider-label">${monoLabel('Backup')}</div>
    ${backupBlock()}
    <div class="divider-label">${monoLabel('This device')}</div>
    <button class="${cls('btn', S.armReset ? 'btn-danger' : 'btn-quiet')}" data-a="resetAll">${S.armReset ? 'Tap again to empty everything' : 'Empty this depot'}</button>
    ${note(S.armReset
      ? 'This cannot be undone and there is no copy anywhere else. Save a backup first if you might want any of it back. Tap anything else to cancel.'
      : 'Everything you enter is kept on this phone only. Emptying removes every van, person, check and defect, and puts the checklist back to the template it shipped with.',
      S.armReset ? '' : 'is-faint')}
    <div class="divider-label">${monoLabel('About')}</div>
    ${note('Fleet Spot-Check ' + BUILD + ' · checklist v' + checklistVersion() + ' · everything stays on this phone.', 'is-faint')}
    <button class="btn btn-quiet" data-a="openAdmin">System admin</button>`;
}

/* The backup pair. Save is one tap; restore is two screens' worth of warning in
   one card, because it overwrites a depot that has no other copy. */
function backupBlock() {
  const sum = S.importSum;

  if (sum) {
    const c = sum.counts;
    return `
      <div class="card is-dashed-red">
        <div class="spread">
          <span style="font:600 16px/1.2 var(--sans)">${esc(sum.name)}</span>
          <span class="flag is-red">Replaces everything</span>
        </div>
        <div class="mono-label">${esc((sum.exportedAt ? 'Saved ' + dmy(dayOf(sum.exportedAt)) : 'No date in the file') + ' · schema ' + sum.schema)}</div>
        <div class="stats">
          ${stat(c.vans, 'Vans')}
          ${stat(c.checks, 'Checks')}
          ${stat(c.defects, 'Defects')}
        </div>
        <div class="mono-label">${esc(c.people + (c.people === 1 ? ' person · ' : ' people · ') +
          c.workshops + (c.workshops === 1 ? ' workshop · ' : ' workshops · ') +
          c.sections + (c.sections === 1 ? ' checklist section' : ' checklist sections'))}</div>
        ${note('Restoring puts this file in place of everything on this phone — every van, person, check and defect. What is here now is gone unless you saved a backup of it first.')}
        <div class="dock-row">
          <button class="btn btn-quiet" data-a="importCancel">Cancel</button>
          <button class="btn is-wide btn-danger" data-a="importConfirm">Replace everything</button>
        </div>
      </div>`;
  }

  const counts = backupCounts(Store.snapshot());
  const has = counts.vans || counts.checks;
  return `
    <button class="btn btn-outline" data-a="exportBackup">Save a backup</button>
    <button class="btn btn-quiet" data-a="importPick">Restore from a backup</button>
    ${note(has
      ? 'Saves the whole depot — ' + counts.vans + (counts.vans === 1 ? ' van, ' : ' vans, ') +
        counts.checks + (counts.checks === 1 ? ' check, ' : ' checks, ') +
        'the people, the workshops and your checklist — as one .json file in your downloads. It is the only copy that exists off this phone, and the only way to move the depot to a different address later. The photos stay on this phone: the file records that a shot was taken, but restoring it on another phone shows those slots empty.'
      : 'Nothing to back up yet. Once there are vans and checks, this saves the whole depot as one .json file — the only copy that exists off this phone.',
      'is-faint')}
    ${STORAGE_DURABLE === null ? '' : note(STORAGE_DURABLE
      ? 'This phone has granted the depot durable storage: the browser will not clear it to free up space. Back up anyway — durable does not survive a lost phone, and it does not cover the photos.'
      : 'This phone has NOT granted durable storage, so the browser may clear the depot if the device runs short on space. Add the app to your home screen and it is usually granted; until then, save a backup often.',
      STORAGE_DURABLE ? 'is-faint' : 'is-amber')}`;
}

/* --- Checklist: sections ------------------------------------------------ */

function viewChecklist() {
  const dirty = isDirty();
  const changes = changeCount();
  const live = liveCount();
  const secs = liveSections();
  const critCount = secs.reduce((a, s) => a + s.items.filter(i => !i.retired && i.crit).length, 0);
  const measCount = secs.reduce((a, s) => a + s.items.filter(i => !i.retired && i.type === 'm').length, 0);

  const rows = S.list.map((s, i) => {
    const liveItems = s.items.filter(x => !x.retired).length;
    return `
      <div class="${cls('list-row', s.retired && 'is-dormant')}">
        <span class="list-main">
          <input class="${cls('rename', s.retired && 'is-dormant')}" value="${esc(s.name)}"
                 data-a="renameSection" data-i="${i}" data-fk="sec-${i}" aria-label="Section name">
          <span class="list-sub">${s.retired ? 'Retired' : liveItems + (liveItems === 1 ? ' check' : ' checks')}</span>
        </span>
        <span class="actions-row">
          <button class="icon-btn" data-a="secUp" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="icon-btn" data-a="secDown" data-i="${i}" ${i === S.list.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button class="icon-btn" data-a="openSection" data-i="${i}" aria-label="Open section">${ICON.chev}</button>
        </span>
      </div>`;
  }).join('');

  return `
    ${monoLabel('Sections — in the order they’re walked')}
    ${rows}
    <button class="btn-add" data-a="addSection">+ Add a section</button>
    <div class="card">${note(live + ' checks live across ' + secs.length + ' sections — ' + critCount + ' safety-critical, ' + measCount + ' measured. A failed safety-critical check takes the van off the road on the spot.')}</div>
    <div class="dock">
      <div class="${cls('mono-label', dirty && 'is-red')}">${dirty
        ? changes + ' change' + (changes === 1 ? '' : 's') + ' not yet live'
        : esc(liveSince())}</div>
      <div class="dock-row">
        <button class="btn btn-quiet" data-a="revertList" ${dirty ? '' : 'disabled'}>Discard</button>
        <button class="btn is-wide ${dirty ? 'btn-primary' : 'btn-disabled'}" data-a="publish" ${dirty ? '' : 'disabled'}>${dirty ? 'Publish v' + (checklistVersion() + 1) : 'Nothing to publish'}</button>
      </div>
    </div>`;
}

/* --- Checklist: one section --------------------------------------------- */

function viewSection() {
  const sec = curSection();
  if (!sec) return `<div class="card">${note('That section is no longer in the checklist. Go back to pick another.')}</div>`;
  const secItems = sec.items;

  const meta = sec.retired
    ? 'Retired · ' + secItems.length + ' checks dormant'
    : secItems.filter(i => !i.retired).length + ' live · ' + secItems.filter(i => i.crit && !i.retired).length + ' safety-critical';

  const rows = secItems.map((it, i) => {
    const meas = it.type === 'm';
    const open = S.openId === it.id;
    const num = it.retired ? '—' : String(secItems.slice(0, i).filter(x => !x.retired).length + 1).padStart(2, '0');
    const typeLine = meas
      ? 'Measured · ' + it.unit + ' · ' + PARTS[it.parts] + ' · fails ' + it.dir + ' ' + fmt(it.limit, it.unit)
      : 'Pass / fail / n-a';
    const sub = it.added ? 'Added — live on the next publish'
      : it.retired ? 'Retired — stays on past records' : typeLine;

    const limitNote = it.dir === 'below'
      ? 'Under ' + fmt(it.limit, it.unit) + it.unit + ' fails on the spot. ' + fmt(it.warn, it.unit) + it.unit + ' and below is flagged as wearing but passes.'
      : 'Over ' + fmt(it.limit, it.unit) + it.unit + ' fails on the spot. ' + fmt(it.warn, it.unit) + it.unit + ' and above is flagged but passes.';

    const setup = !open ? '' : `
      <div class="setup" style="flex:1 1 100%">
        <div class="chip-row">
          <button class="chip ${meas ? '' : 'is-on'}" data-a="setPF" data-i="${i}">Pass / fail</button>
          <button class="chip ${meas ? 'is-on' : ''}" data-a="setM" data-i="${i}">Measured reading</button>
        </div>
        ${!meas ? `
          <div class="card" style="flex-direction:row;align-items:center;gap:9px;padding:4px 12px;min-height:var(--tap)">
            <span class="mono-label" style="flex:none">Hint</span>
            <input class="hint-input" value="${esc(it.hint)}" data-a="setHint" data-i="${i}" data-fk="hint-${i}"
                   placeholder="e.g. look under, not just around" aria-label="Inspector hint">
          </div>` : `
          <div class="chip-row">
            <button class="chip" data-a="cycleUnit" data-i="${i}">Unit · ${esc(it.unit)}</button>
            <button class="chip" data-a="cycleParts" data-i="${i}">${esc(PARTS[it.parts])}</button>
            <button class="chip is-red" data-a="cycleDir" data-i="${i}">${it.dir === 'below' ? 'Fails below' : 'Fails above'}</button>
          </div>
          <div class="stepper is-red">
            <span class="stepper-text">
              <span class="field-label">Fail limit</span>
              <span class="field-value">${esc(fmt(it.limit, it.unit) + ' ' + it.unit)}</span>
            </span>
            <button class="icon-btn" data-a="limitDown" data-i="${i}" aria-label="Decrease fail limit">−</button>
            <button class="icon-btn" data-a="limitUp" data-i="${i}" aria-label="Increase fail limit">+</button>
          </div>
          <div class="stepper">
            <span class="stepper-text">
              <span class="field-label">Watch from</span>
              <span class="field-value">${esc(fmt(it.warn, it.unit) + ' ' + it.unit)}</span>
            </span>
            <button class="icon-btn" data-a="warnDown" data-i="${i}" aria-label="Decrease watch level">−</button>
            <button class="icon-btn" data-a="warnUp" data-i="${i}" aria-label="Increase watch level">+</button>
          </div>
          ${note(limitNote)}`}
      </div>`;

    return `
      <div class="${cls('list-row', it.retired && 'is-dormant', !it.retired && it.crit && 'is-crit', open && 'is-selected')}" style="flex-wrap:wrap">
        <span class="num">${esc(num)}</span>
        <span class="list-main">
          <input class="${cls('rename', it.retired && 'is-dormant')}" value="${esc(it.name)}"
                 data-a="renameItem" data-i="${i}" data-fk="item-${i}" aria-label="Check name">
          <span class="${cls('list-sub', it.crit && !it.retired && 'is-red')}">${esc(sub)}</span>
        </span>
        <span class="actions-row">
          <button class="icon-btn" data-a="itemUp" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="icon-btn" data-a="itemDown" data-i="${i}" ${i === secItems.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        </span>
        <span class="chip-row" style="flex:1 1 100%">
          <button class="chip ${it.crit ? 'is-red-on' : ''}" data-a="toggleCrit" data-i="${i}">${it.crit ? 'Safety-critical' : 'Routine'}</button>
          <button class="chip" data-a="retireItem" data-i="${i}">${it.retired ? 'Restore' : 'Retire'}</button>
          <button class="chip ${open ? 'is-on' : ''}" data-a="openItem" data-id="${esc(it.id)}">${open ? 'Close' : 'Set up'}</button>
        </span>
        ${setup}
      </div>`;
  }).join('');

  return `
    <div class="divider-label">
      ${monoLabel(meta)}
      <button class="chip is-ghost" data-a="retireSection">${sec.retired ? 'Restore' : 'Retire'}</button>
    </div>
    ${sec.retired ? `<div class="card is-dormant">
      ${monoLabel('Section retired — not on new inspections')}
      ${note('Nobody will be asked these checks again. Restore the section before editing it — anything changed here stays dormant.')}
    </div>` : ''}
    ${rows || `<div class="empty">${note('No checks in this section yet.', 'is-faint')}</div>`}
    ${sec.retired ? '' : `<button class="btn-add" data-a="addItem">+ Add a check to ${esc(sec.name)}</button>`}
    <div class="card">${note('A retired check stops appearing on new inspections but stays on every record sheet that already used it — nothing is deleted.')}</div>
    ${note('Limits set here are what the phone judges against. Tread is legally 1.5mm — set it higher if you want the van in earlier, never lower.', 'is-faint')}`;
}

/* --- Who are you? ------------------------------------------------------- */

/*
   The sign-in, such as it is. Phase 3 ruled there is no login — own phone,
   phone lock is the auth — so this is a chooser, not an authenticator: it
   settles WHOSE NAME goes on what this phone signs, and lets that be cleared.

   It is deliberately not the People screen. People is depot admin (add, rename,
   change role, suspend, delete); this is one question with one answer, reached
   from the header, and it must not put a suspend button under a thumb that came
   here to switch person.
*/
function viewWho() {
  const signer = me();
  const crew = peopleList().filter(p => p.active && p.role !== 'admin');

  /* The discreet way back into the hidden admin area. Only shown signed out —
     it is a footnote on the gate, not a crew action — and rendered in BOTH the
     empty and populated branches, because right after first run the only person
     is the admin: sign out then and the crew list is empty, so without this here
     there would be no route back to the admin from the gate. */
  const adminFoot = !signer ? `
      <div class="dock is-foot">
        <button class="btn btn-quiet" data-a="openAdmin">System admin</button>
      </div>` : '';

  if (!crew.length) {
    return `
      ${emptyState('Nobody on the depot yet',
        'Checks are signed by name, so there has to be a name to sign with. Add the crew first.',
        { label: 'Go to People', action: 'openPeople' })}
      ${adminFoot}`;
  }

  const rows = crew.map(p => {
    const on = signer && signer.id === p.id;
    return `
      <button class="${cls('list-row', on && 'is-selected')}" data-a="beMe" data-id="${esc(p.id)}"
              aria-pressed="${on ? 'true' : 'false'}">
        <span class="list-main">
          <span class="list-title">${esc(p.name)}</span>
          <span class="list-sub">${esc(ROLE_LABEL[p.role] + (p.role === 'manager' ? ' · can countersign' : ' · checks vans'))}</span>
        </span>
        ${on ? `<span class="flag">That’s me</span>` : `<span class="chev">${ICON.chev}</span>`}
      </button>`;
  }).join('');

  /* Sign out is docked at the foot of the screen, not tucked under the list.
     It is the one thing here that is not "pick a name", so it sits where every
     other screen's terminal action sits — thumb-height, above the tab bar —
     rather than reading as a seventh row of the crew list. */
  return `
    ${monoLabel(signer ? 'Signed in as ' + signer.name : 'Nobody signed in')}
    ${rows}
    ${signer ? `
      <div class="dock is-foot">
        <button class="btn btn-quiet" data-a="signOut">Sign out</button>
      </div>` : adminFoot}`;
}

/* --- Setup & hidden admin ----------------------------------------------- */

/*
   The very first screen a blank depot shows. There is no crew, so nobody can
   sign in, so nobody can add the crew — the app would deadlock on an empty
   People list. This breaks the loop: it creates the ADMIN, the hidden setup
   role that exists only to get the depot going and never appears in any crew
   list afterwards. One field, one button, matching the app's no-PIN rule.
*/
function viewSetup() {
  return emptyState('Set up the system first',
    'This phone has no depot on it yet. Start by creating the admin — the hidden account that sets up the crew, the vans, the workshops and the draw rules. The admin never checks a van and never countersigns; it only gets the depot going, and it stays out of every crew list once it has.',
    { label: 'Set up admin', action: 'openAdminModal' });
}

/* The one modal in the app. Everything else that overlays a screen is a bottom
   sheet (help) or a non-dimming menu (identity); creating the admin is a
   deliberate, one-answer commitment, so it gets a centred dialog with a Cancel
   that costs nothing. Rendered off the topbar like helpSheet(), so it survives
   the full-screen re-render and floats over whatever is behind it. */
function adminModal() {
  if (!S.adminModal) return '';
  const named = !!S.adminName.trim();
  return `
    <div class="modal-scrim" data-a="closeAdminModal"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Create the admin">
      <h2 class="modal-title">Create the admin</h2>
      ${note('The admin sets the depot up and stays hidden from the crew. Give it a name so its setup carries a signature — no PIN, same as everyone.', 'is-faint')}
      <label class="field">
        <span class="field-label">Admin name</span>
        <input class="field-input" data-a="editAdminName" data-fk="admin-name"
               value="${esc(S.adminName)}" type="text" maxlength="40"
               placeholder="e.g. Depot admin" aria-label="Admin name">
      </label>
      <div class="dock-row">
        <button class="btn btn-quiet" data-a="closeAdminModal">Cancel</button>
        <button class="btn is-wide ${named ? 'btn-primary' : 'btn-disabled'}" data-a="createAdmin" ${named ? '' : 'disabled'}>Create admin</button>
      </div>
    </div>`;
}

/*
   The admin's own area, reached only from the discreet links in Settings and on
   the sign-in gate — never a tab, never a crew list. It lists the admins so one
   can be signed into (an admin still needs to be "who this phone is" to do the
   setup that carries their name), and can mint more. Everything else the admin
   does — people, vans, workshops, rules — is the ordinary depot setup, reached
   the ordinary way once signed in; this screen only holds the identity itself.
*/
function viewAdmin() {
  const signer = me();
  const rows = admins().map(p => {
    const on = signer && signer.id === p.id;
    return `
      <button class="${cls('list-row', on && 'is-selected')}" data-a="beMe" data-id="${esc(p.id)}"
              aria-pressed="${on ? 'true' : 'false'}">
        <span class="list-main">
          <span class="list-title">${esc(p.name)}</span>
          <span class="list-sub">Admin · sets the depot up · hidden from crew</span>
        </span>
        ${on ? `<span class="flag">That’s me</span>` : `<span class="chev">${ICON.chev}</span>`}
      </button>`;
  }).join('');

  return `
    ${monoLabel('Hidden setup accounts')}
    ${rows || `<div class="empty">${note('No admin on this depot.', 'is-faint')}</div>`}
    <button class="btn-add" data-a="openAdminModal">+ Add an admin</button>
    <div class="card">${note('Admins set up the depot — people, vans, workshops and the draw rules — but never check a van and never countersign. They stay off the People list and the sign-in switcher; this is the only screen they appear on.')}</div>`;
}

/* --- People ------------------------------------------------------------- */

/* How much of the record a person's name is already on. Deleting them does not
   touch any of it — a check copies inspectorName onto itself at submit, exactly
   so it still reads correctly after the person has left — but the number is
   what makes "nothing is lost" believable instead of just asserted. */
const personCheckCount = id =>
  Store.count('checks', c => c.inspectorId === id || c.secondId === id);

function viewPeople() {
  const signer = me();
  const cards = peopleList().filter(p => p.role !== 'admin').map(p => {
    const isMgr = p.role === 'manager';
    const armed = S.armDelPerson === p.id;
    const onChecks = personCheckCount(p.id);
    const isMe = !!signer && signer.id === p.id;
    return `
      <div class="${cls('card', !p.active && 'is-dormant', armed && 'is-red-strong')}" style="${p.active && isMgr && !armed ? 'border-color:var(--ink)' : ''}">
        <div class="row-tap">
          <input class="${cls('rename', !p.active && 'is-dormant')}" value="${esc(p.name)}"
                 data-a="renamePerson" data-id="${esc(p.id)}" data-fk="ppl-${esc(p.id)}" aria-label="Person name">
          <button class="chip ${isMgr ? 'is-on' : ''}" data-a="cycleRole" data-id="${esc(p.id)}">${esc(ROLE_LABEL[p.role])}</button>
        </div>
        ${note(isMgr
          ? 'Countersigns anyone’s check. Edits the checklist and the draw rules.'
          : 'Checks vans and re-checks defects. Sees their own checks, not other people’s.')}
        ${armed
          ? note('Tap Delete again to remove ' + p.name + ' from the depot. ' +
              (onChecks
                ? 'Their name stays on ' + onChecks + (onChecks === 1 ? ' check' : ' checks') + ' — those records don’t change. '
                : 'They aren’t on any check. ') +
              'Tap anything else to cancel.', 'is-red')
          : ''}
        <div class="row-tap">
          <span class="list-sub" style="flex:1 1 auto">${isMe ? 'This is you on this phone' : 'Signs in by name — no PIN'}</span>
          <button class="chip" data-a="toggleActive" data-id="${esc(p.id)}">${p.active ? 'Suspend' : 'Reinstate'}</button>
          <button class="${cls('chip', armed && 'is-red-on')}" data-a="delPerson" data-id="${esc(p.id)}">Delete</button>
        </div>
      </div>`;
  }).join('');

  /* No heading. The screen is called People, the header already says so, and a
     list of people under a label reading "Two roles — inspectors check,
     managers countersign" was a caption explaining a picture that explains
     itself: every card names its own role on it. The two standing notes that
     used to close the screen — what Suspend keeps and what Delete does not
     touch — are behind the (i) in the header now. See HELP. */
  return `
    ${cards}
    <button class="btn-add" data-a="addPerson">+ Add someone</button>`;
}

/* --- Workshops ---------------------------------------------------------- */

function viewWorkshops() {
  const shops = Store.all('workshops');

  if (!shops.length) {
    return `
      ${emptyState('No workshops yet',
        'A workshop is who a defect gets sent to. Until there is at least one here, a failed check can be read but not countersigned.',
        { label: '+ Add a workshop', action: 'addWorkshop' })}
      <div class="card">${note('Use whatever name the depot actually says out loud — it is what appears on the defect card and on the job you chase.')}</div>`;
  }

  const cards = shops.map(w => {
    const jobs = shopOpenCount(w.id);
    const jobLine = jobs
      ? jobs + (jobs === 1 ? ' open job' : ' open jobs')
      : 'Nothing open';
    return `
      <div class="${cls('card', !w.active && 'is-dormant')}">
        <div class="row-tap">
          <input class="${cls('rename', !w.active && 'is-dormant')}" value="${esc(w.name)}"
                 data-a="renameWorkshop" data-id="${esc(w.id)}" data-fk="shop-${esc(w.id)}"
                 maxlength="40" aria-label="Workshop name">
          <span class="${cls('flag', jobs ? 'is-ink' : 'is-faint')}">${esc(jobLine)}</span>
        </div>
        ${note(w.active
          ? 'On the list when you countersign a failed check.'
          : 'Retired — not offered on new defects. Jobs already sent here stay with them.')}
        <div class="row-tap">
          <span class="list-sub" style="flex:1 1 auto">${esc(w.active ? 'Taking work' : 'Not taking work')}</span>
          <button class="chip" data-a="toggleWorkshop" data-id="${esc(w.id)}">${w.active ? 'Retire' : 'Reinstate'}</button>
        </div>
      </div>`;
  }).join('');

  const activeCount = workshopList().length;
  return `
    ${monoLabel(activeCount ? activeCount + ' taking work' : 'None taking work')}
    ${cards}
    <button class="btn-add" data-a="addWorkshop">+ Add a workshop</button>
    ${activeCount ? '' : `<div class="card is-red">${monoLabel('Nothing can be countersigned')}${note('Every workshop is retired, so a failed check has nowhere to go. Reinstate one, or add another.')}</div>`}
    <div class="card">${note('Retiring a workshop never moves the jobs already sent there — those stay open and chaseable until someone closes them. It only takes the workshop off the list for new defects.')}</div>`;
}

/* --- Capture: start ----------------------------------------------------- */

/* Three ways a depot can't run a check at all, and each needs a different way
   out — so they are separate empty states, not one "not set up" message. */
function capBlockedState() {
  if (!capVans().length) {
    return emptyState('No fleet yet',
      'A spot-check is a record about a van. Add the fleet first, then come back.',
      { label: '+ Add a van', action: 'addFirstVan' });
  }
  if (!capInspectors().length) {
    return emptyState('Nobody to sign it',
      'A check carries the name of whoever walked it. Add at least one active person before starting one.',
      { label: 'Go to People', action: 'openPeople' });
  }
  if (!capAll().length) {
    return emptyState('Nothing to check',
      'Every checklist item is retired, so the walk would be empty. Put something back on the list first.',
      { label: 'Go to More', action: 'tab', id: 'more' });
  }
  return '';
}

function viewCaptureStart() {
  const blocked = capBlockedState();
  if (blocked) return blocked;
  if (!S.cap) return emptyState('No check open', 'Draw a van from Vehicles Check to start one.', { label: 'Go to Vehicles Check', action: 'tab', id: 'queue' });

  const c = S.cap;
  const vans = capVans();
  const crew = capInspectors();
  const van = capVan();
  const inspector = crew.filter(p => p.id === c.inspectorId)[0] || null;
  const ready = !!(van && inspector);

  /* The second pair of eyes is optional and is genuinely a second person —
     never the inspector themselves, so they drop out of their own list. */
  const seconds = crew.filter(p => p.id !== c.inspectorId);
  const second = seconds.filter(p => p.id === c.secondId)[0] || null;

  return `
    ${monoLabel(capAll().length + ' items · v' + checklistVersion())}
    <div class="field-row">
      <label class="${cls('field', !van && 'is-required')}">
        <span class="field-label">Van *</span>
        <select class="${cls('field-select', !van && 'is-empty')}" data-a="capPickVan" data-fk="cap-van"
                aria-label="Which van is being checked">
          <option value=""${van ? '' : ' selected'}>— pick a van —</option>
          ${vans.map(v => `<option value="${esc(v.id)}"${van && van.id === v.id ? ' selected' : ''}>${esc(v.reg + (v.model ? ' · ' + v.model : ''))}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="field-row">
      <label class="${cls('field', !inspector && 'is-required')}">
        <span class="field-label">Walked by *</span>
        <select class="${cls('field-select', !inspector && 'is-empty')}" data-a="capPickInspector" data-fk="cap-who"
                aria-label="Who is walking this check">
          <option value=""${inspector ? '' : ' selected'}>— pick a person —</option>
          ${crew.map(p => `<option value="${esc(p.id)}"${inspector && inspector.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Second pair of eyes</span>
        <select class="${cls('field-select', !second && 'is-empty')}" data-a="capPickSecond" data-fk="cap-second"
                aria-label="Second person present, optional">
          <option value=""${second ? '' : ' selected'}>— nobody —</option>
          ${seconds.map(p => `<option value="${esc(p.id)}"${second && second.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        <span class="field-label">Odometer</span>
        <input class="${cls('field-input', c.mileage === '' && 'is-empty')}" data-a="capMileage" data-fk="cap-miles"
               value="${esc(c.mileage)}" type="number" inputmode="numeric" min="0" step="1"
               placeholder="km on the clock" aria-label="Odometer reading in kilometres">
      </label>
    </div>
    ${note('Brake lights and indicators are easier with someone watching. Naming them puts both signatures on the record.', 'is-faint')}
    <div class="dock">
      <div class="dock-row">
        <button class="btn btn-outline" data-a="capAbandon">Cancel</button>
        <button class="${cls('btn', 'is-wide', ready ? 'btn-primary' : 'btn-disabled')}" data-a="capBegin" ${ready ? '' : 'disabled'}>
          ${ready ? 'Start the walk' : 'Van and inspector required'}
        </button>
      </div>
    </div>`;
}

/* --- Capture: the walk -------------------------------------------------- */

const OUTCOMES = [['pass', 'Pass'], ['fail', 'Fail'], ['na', 'N/A']];
const SEVERITIES = [['minor', 'Minor'], ['major', 'Major']];

/* One control, three states, no green in the palette: a pass reads as plain
   ink. Colour is spent on the thing that needs chasing, not on the 90% of a
   check that is fine. */
const segRow = (action, id, cur, opts) => `
  <div class="seg" role="group">
    ${opts.map(([v, l]) => `<button class="${cls('seg-btn', cur === v && 'is-on', cur === v && (v === 'fail' || v === 'major') && 'is-fail')}"
        data-a="${esc(action)}" data-id="${esc(id)}" data-v="${esc(v)}" aria-pressed="${cur === v}">${esc(l)}</button>`).join('')}
  </div>`;

const limitLine = it =>
  'Fails ' + (it.dir === 'above' ? 'over ' : 'under ') + fmt(it.limit, it.unit) + ' ' + it.unit
  + ' · watch ' + fmt(it.warn, it.unit) + ' ' + it.unit;

/* type="text" with inputmode="decimal", not type="number": a number input
   reports value '' while the user is mid-decimal ("1."), and since every
   keystroke re-renders, that would delete the digit they just typed. The
   keypad is the same on a phone either way. */
function capReadings(it, r) {
  return `
    <div class="read-grid">
      ${partNames(it).map((p, i) => {
        const st = readingState(it, r.values[i]);
        return `
        <label class="${cls('field', st === 'fail' && 'is-required', st === 'warn' && 'is-watch')}">
          <span class="field-label">${esc(p + ' · ' + it.unit)}</span>
          <input class="${cls('field-input', r.values[i] === '' && 'is-empty')}" data-a="capReading"
                 data-id="${esc(it.id)}" data-i="${i}" data-fk="${esc('cap-' + it.id + '-' + i)}"
                 value="${esc(r.values[i])}" type="text" inputmode="decimal"
                 placeholder="—" aria-label="${esc(it.name + ' — ' + p)}">
        </label>`;
      }).join('')}
    </div>
    ${monoLabel(limitLine(it), 'is-faint')}`;
}

/* The note is what a fitter reads at 7am with the van in front of them. An
   empty one is why "N/S front tyre" jobs come back untouched. */
function capFailFields(it, r) {
  const thin = (r.note || '').trim().length < 3;
  return `
    ${monoLabel('How bad is it')}
    ${segRow('capSeverity', it.id, r.severity, SEVERITIES)}
    <button class="check-row" data-a="capSafe" data-id="${esc(it.id)}" aria-pressed="${r.safeToDrive === false}">
      <span class="${cls('box', r.safeToDrive === false && 'is-on')}">${r.safeToDrive === false ? ICON.tick : ''}</span>
      <span>Not safe to drive</span>
    </button>
    <textarea class="textarea" data-a="capNote" data-id="${esc(it.id)}" data-fk="${esc('cap-note-' + it.id)}"
              rows="2" placeholder="What's wrong — the workshop only gets this line"
              aria-label="What is wrong with ${esc(it.name)}">${esc(r.note || '')}</textarea>
    ${thin ? monoLabel('A note is required before this check can be submitted', 'is-red') : ''}`;
}

function capCard(it) {
  const r = capRes(it.id) || blankRes(it);
  const failed = r.outcome === 'fail';

  return `
    <div class="${cls('card', failed && 'is-red')}">
      <div class="spread">
        <span style="font:500 17px/1.3 var(--sans)">${esc(it.name)}</span>
        ${it.crit ? '<span class="flag is-red">Critical</span>' : ''}
      </div>
      ${it.hint ? monoLabel(it.hint, 'is-faint') : ''}
      ${it.type === 'm' ? capReadings(it, r) : ''}
      ${segRow('capSet', it.id, r.outcome, it.type === 'm' ? [['na', 'Not applicable']] : OUTCOMES)}
      ${failed ? capFailFields(it, r) : ''}
    </div>`;
}

function viewCapture() {
  if (!S.cap) return emptyState('No check open', 'Draw a van from Vehicles Check to start one.', { label: 'Go to Vehicles Check', action: 'tab', id: 'queue' });

  const secs = capSections();
  const sec = capSection();
  if (!sec) return emptyState('Nothing to check', 'Every checklist item is retired.', null);

  const i = S.cap.secIdx;
  const last = i >= secs.length - 1;
  const van = capVan();
  const doneHere = capDone(sec);

  return `
    <div class="stack-sm">
      <div class="spread">
        <span class="reg">${esc(van ? van.reg : '—')}</span>
        <span class="flag">${esc('Section ' + (i + 1) + ' of ' + secs.length)}</span>
      </div>
      <div class="mono-label">${esc(doneHere + ' of ' + sec.items.length + ' answered · ' + capLeft() + ' left in the whole check')}</div>
    </div>
    ${sec.items.map(capCard).join('')}
    <div class="dock">
      <div class="dock-row">
        <button class="${cls('btn', i ? 'btn-outline' : 'btn-disabled')}" data-a="capPrevSec" ${i ? '' : 'disabled'}>Back</button>
        <button class="btn is-wide btn-primary" data-a="${last ? 'capReview' : 'capNextSec'}">
          ${last ? 'Review & submit' : esc('Next — ' + secs[i + 1].name)}
        </button>
      </div>
    </div>`;
}

/* --- Capture: review ---------------------------------------------------- */

/* The walk-around photos, taken on the review screen — the inspector is back at
   the van with the whole thing in front of them. Tapping a tile opens the
   camera (rear camera on a phone); a taken shot can be retaken by tapping it or
   removed with its ×. Ids go into S.cap.photos; the bytes are already in
   IndexedDB by the time the tile shows anything. */
function capPhotoGrid() {
  const photos = (S.cap && S.cap.photos) || {};
  const done = SHOTS.filter(l => photos[l]).length;
  const tiles = SHOTS.map(l => {
    const id = photos[l];
    return id
      ? `<div class="shot has-img">
           <button class="shot-hit" data-a="capPhoto" data-shot="${esc(l)}" aria-label="${esc('Retake ' + shotLabel(l))}"><img data-photo-id="${esc(id)}" alt=""></button>
           <button class="shot-x" data-a="capPhotoRemove" data-shot="${esc(l)}" aria-label="${esc('Remove ' + shotLabel(l))}">×</button>
           <span class="shot-tag">${esc(shotLabel(l))}</span>
         </div>`
      : `<button class="shot is-empty" data-a="capPhoto" data-shot="${esc(l)}" aria-label="${esc('Add ' + shotLabel(l) + ' photo')}"><span class="shot-add">+</span><span class="shot-tag">${esc(shotLabel(l))}</span></button>`;
  }).join('');
  return `
    ${monoLabel('Walk-around photos · ' + done + ' of ' + SHOTS.length)}
    <div class="shot-grid">${tiles}</div>
    ${note('The photo is what the workshop and the countersigning manager actually go on. Shots are optional — but a fail with no photo is easy to wave through, and easy to dispute later.', 'is-faint')}`;
}

function viewCaptureReview() {
  if (!S.cap) return emptyState('No check open', 'Draw a van from Vehicles Check to start one.', { label: 'Go to Vehicles Check', action: 'tab', id: 'queue' });

  const t = capTally();
  const fails = capFails();
  const left = capLeft();
  const thin = capThinNotes();
  const ready = capReady();
  const van = capVan();

  const failCards = fails.map(e => {
    const r = capRes(e.it.id);
    const meta = sentence(r.severity || 'minor') + ' · Safe to drive: ' + (r.safeToDrive === false ? 'no' : 'yes');
    return `
      <div class="card is-red">
        <div class="spread">
          <span style="font:500 17px/1.3 var(--sans)">${esc(e.it.name)}</span>
          <span class="flag is-red">${esc(e.sec.name)}</span>
        </div>
        <div class="mono-label is-red">${esc(meta)}</div>
        ${r.note && r.note.trim().length > 2
          ? note(r.note)
          : `${note('No note written — the workshop would get nothing to act on.', 'is-red')}
             <button class="btn-add" data-a="capGoTo" data-id="${esc(e.sec.id)}">Write it</button>`}
      </div>`;
  }).join('');

  /* Unanswered is not the same as a clean pass, and submitting must not blur
     the two — the check names what is missing and where it is. */
  const gaps = capAll().filter(e => !capAnswered(e.it.id));
  const gapSecs = gaps.reduce((a, e) => (a.indexOf(e.sec.name) < 0 ? a.concat(e.sec.name) : a), []);

  const blocker = left
    ? emptyState(left + (left === 1 ? ' item not answered' : ' items not answered'),
        'Still open in ' + gapSecs.join(', ') + '. A gap on a spot-check reads as "nobody looked", so it has to be a pass, a fail or an explicit N/A.',
        { label: 'Back to ' + gapSecs[0], action: 'capGoTo', id: gaps[0].sec.id })
    : (thin ? `<div class="card is-red">${monoLabel('A defect has no note')}${note('Every fail needs one line the workshop can act on. Tap “Write it” above.')}</div>` : '');

  return `
    <div class="stack-sm">
      <div class="spread"><span style="font:600 21px/1.2 var(--sans)">${esc(van ? van.reg : '—')} — ${esc(dmy(Store.today()))}</span></div>
      <div class="mono-label">${esc((S.cap.inspectorName || '') + (S.cap.secondName ? ' + ' + S.cap.secondName : '') || 'Unsigned')}</div>
    </div>
    <div class="stats">
      ${stat(t.pass, 'Passed')}
      ${stat(t.fail, 'Failed', !!t.fail)}
      ${stat(t.na, 'N/A')}
    </div>
    ${fails.length ? monoLabel(fails.length === 1 ? '1 defect to raise' : fails.length + ' defects to raise') : monoLabel('Nothing failed')}
    ${failCards}
    ${blocker}
    ${capPhotoGrid()}
    ${note(fails.length
      ? 'Submitting sends this to the depot queue. The jobs are raised when a manager countersigns it — not before.'
      : 'Submitting sends this to the depot queue for countersigning. Nothing else happens to the van.', 'is-faint')}
    <div class="dock">
      <div class="dock-row">
        <button class="btn btn-outline" data-a="capBackToWalk">Back</button>
        <button class="${cls('btn', 'is-wide', ready ? 'btn-primary' : 'btn-disabled')}" data-a="capSubmit" ${ready ? '' : 'disabled'}>
          ${ready ? 'Submit this check' : (left ? esc(left + ' still open') : 'Note required')}
        </button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------- render --- */

const SCREENS = {
  /* The home screen wears the depot's own name. It used to be the hardcoded
     string 'Barking depot' — a leftover from the design this was built from,
     sitting above somebody else's vans on every install. Unnamed now reads
     'Depot', which is plain and true, until someone types the real one in
     Settings. */
  /* Named for what you do here, not for what is stacked up here. The screen
     used to wear the depot's name because it was the home screen and a home
     screen says where you are; now it has a job — draw a van, walk it — and
     the title says that instead. The depot's name moved to the head of More,
     which is where the depot itself is set up. */
  queue: { title: 'Vehicles Check', view: viewQueue },
  history: { title: 'History', view: viewHistory, back: true },
  check: { title: () => (selectedCheck() ? selectedCheck().reg : 'Check'), view: viewCheck, back: true },
  defects: { title: 'Open defects', view: viewDefects },
  coverage: { title: 'Coverage', view: viewCoverage, back: true },
  draw: { title: () => (Store.get('vans', S.draw.vanId) || {}).reg || 'The draw', view: viewDraw, back: true },
  vans: { title: 'Vans', view: viewVans },
  van: { title: () => (S.adding ? 'New van' : S.draft.reg), view: viewVan, back: true },
  more: { title: 'More', view: viewMore },
  settings: { title: 'Settings', view: viewSettings, back: true },
  whoami: { title: 'Who are you?', view: viewWho, back: true },
  /* The bootstrap screen, shown only while the depot has no people (see
     render()). It is not reachable by nav — it pre-empts it — so it takes no
     Back. */
  setup: { title: 'Set up the system', view: viewSetup },
  /* The hidden admin's own area. Reached only from the discreet links in
     Settings and on the sign-in gate, never from a tab or a crew list. */
  admin: { title: 'System admin', view: viewAdmin, back: true },
  checklist: { title: 'Checklist', view: viewChecklist, back: true },
  section: { title: () => (curSection() ? curSection().name : 'Section'), view: viewSection, back: true },
  people: { title: 'People', view: viewPeople, back: true },
  workshops: { title: 'Workshops', view: viewWorkshops, back: true },
  'capture-start': { title: 'Record a spot-check', view: viewCaptureStart, back: true },
  capture: { title: () => (capVan() ? capVan().reg : 'Spot-check'), view: viewCapture, back: true },
  'capture-review': { title: 'Review & submit', view: viewCaptureReview, back: true }
};

let transition = '';

/* The browser's ruling on durable storage, set by claimStorage() after first
   paint. null = not answered yet (or the browser has no Storage API), true =
   this depot survives storage pressure, false = it is evictable. Rendered only
   in the backup card; nothing else branches on it. */
let STORAGE_DURABLE = null;

function renderTopbar(screen) {
  const def = SCREENS[screen];
  const title = typeof def.title === 'function' ? def.title() : def.title;

  /* The setup screen has no signer, no tabs and nothing to explain — nobody
     exists yet. It gets a bare bar with the title only, plus the admin modal it
     opens. No avatar (there is no identity to show or switch), no help, no
     Back (it is not a screen you navigated to). */
  if (screen === 'setup') {
    return `
      <div class="topbar-lead"></div>
      <span class="topbar-title">${esc(title)}</span>
      <div class="topbar-trail"></div>
      ${adminModal()}`;
  }

  const pending = pendingChecks();
  const sync = pending.length
    ? pending.length + (pending.length === 1 ? ' check' : ' checks') + ' waiting'
    : 'All clear';
  const signer = me();
  const who = signer ? ROLE_LABEL[signer.role] + ' · ' + signer.name : 'Not signed in';

  /* Signed out, "Who are you?" stops being a screen you visited and becomes the
     one question on the phone: no Back, no title, no tabs (see render()). The
     way off it is to pick a name — `beMe` calls history.back() — so it is a
     gate, not a dead end, and a hardware or gesture back still pops it because
     the screen was pushed onto the stack like any other. */
  const gate = screen === 'whoami' && !signer;

  const backBtn = def.back && !gate
    ? `<button class="back" data-a="back" aria-label="Back">${ICON.back}<span>Back</span></button>`
    : '';

  /* The build stamp, in the left gutter — a track that is otherwise empty on
     every top-level screen. Only shown when Back is not there: the gutter is
     one `minmax(min-content, 1fr)` track, so anything sharing it with Back
     widens the left gutter past the right one and drags the centred title off
     the bar's centre line. A version you can only read on the five tab screens
     is no loss — you are on one of them within a tap, and the question it
     answers ("which build is this phone running?") is asked once, not mid-task.
     Marked aria-hidden: it is a diagnostic for you, and a screen reader
     announcing "v28" before every screen title is noise. The full string is on
     Settings, where it is already spelled out with the checklist version. */
  const build = backBtn || gate ? '' : `<span class="build-tag" aria-hidden="true">${esc(BUILD)}</span>`;

  /* The identity is a button, not a label. It is the only place "who am I" is
     shown, so it has to be the place you change it — a sign-out buried three
     menus down is a sign-out nobody finds.

     The avatar is now that button, parked far right where every app keeps an
     account. It sits outside the title/meta column and spans both rows: it is
     the one thing on this bar that is about YOU rather than about the screen,
     so it should not sit in the reading order of the screen's own labels.

     The name used to ALSO sit spelled out on a second line under the title.
     That line is gone at the user's request, which buys a one-row header that
     reads as app chrome rather than a document header. The trade-off is real
     and worth naming: initials are ambiguous (two people can both be DW), so
     the only always-visible identity is now two letters. What still carries
     the full name — `who` below labels the avatar for assistive tech, and the
     Who-are-you screen spells it out — is a tap or a focus away, not on
     screen. If a mis-read signature ever shows up in the depot, this is the
     first thing to put back. */
  const ini = signer ? initials(signer.name) : '';
  const face = ini ? `<span class="avatar-ini">${esc(ini)}</span>` : ICON.person;

  /* The waiting count rides ON the avatar now instead of sitting beside it as
     its own line of text. It belongs there: `pendingChecks()` is exactly the
     work awaiting a countersignature, which is the signed-in manager's own
     queue — a badge on the face that stands for them says "this is on you"
     far more directly than a neutral status pill did.
     Only the magnitude is shown, capped at 9+; the exact figure already lives
     on the Queue tab, and a header badge only has to answer "is there
     anything, and roughly how much". Nobody signed in means no badge at all:
     with no signer it is nobody's queue, so there is nothing to nudge about. */
  const waiting = signer ? pending.length : 0;
  const badge = waiting
    ? `<span class="avatar-badge">${waiting > 9 ? '9+' : waiting}</span>`
    : '';

  /* Tapping the avatar used to go straight to the Who-are-you screen, and sign
     out lived at the bottom of it. That is one screen and a scroll away from
     the thing people actually come to the avatar for at the end of a shift, so
     a signed-in tap now drops a two-item menu instead: switch person, or sign
     out. The screen is still there behind "Switch person" — nothing moved out
     of it, this only puts the end-of-shift action within one tap.

     Nobody signed in gets NO menu and goes straight through to the screen as
     before: with no signer there is nothing to sign out of, and a one-item
     menu is just a slower button.

     The head spells the name out in full on purpose. The header itself has
     carried only initials since the identity line came out, and two letters
     are ambiguous — this is now the quickest place to check that the phone is
     signing as who you think it is before you countersign anything. */
  const menu = signer && S.whoMenu ? `
    <div class="who-scrim" data-a="closeWhoMenu"></div>
    <div class="who-menu" role="menu" aria-label="Signed in">
      <div class="who-menu-head">
        <span class="who-menu-name">${esc(signer.name)}</span>
        <span class="who-menu-role">${esc(ROLE_LABEL[signer.role] + (signer.role === 'manager' ? ' · can countersign' : ' · checks vans'))}</span>
      </div>
      <button class="who-menu-item" data-a="whoSwitch" role="menuitem">Switch person</button>
      <button class="who-menu-item is-red" data-a="signOut" role="menuitem">Sign out</button>
    </div>` : '';

  /* The right gutter is a row, not a single control, so the (i) can sit inboard
     of the avatar. Order matters: the avatar stays hard against the edge where
     every app keeps an account and where the thumb already knows to find it,
     and help slots in beside it rather than displacing it. On the gate there is
     nothing to explain and nothing to be signed in as — but the avatar is how
     you get OFF the gate, so only the help goes. */
  return `
    <div class="topbar-lead">${backBtn}${build}</div>
    ${gate ? '' : `<span class="topbar-title">${esc(title)}</span>`}
    <div class="topbar-trail">
      ${gate ? '' : topbarHelp(screen)}
      <button class="${cls('avatar', !signer && 'is-none', waiting && 'has-badge')}" data-a="openWho"
              ${signer ? `aria-haspopup="menu" aria-expanded="${S.whoMenu ? 'true' : 'false'}"` : ''}
              aria-label="${esc(who + ' — switch person or sign out' + (waiting ? '. ' + sync : ''))}"
              >${face}${badge}</button>
    </div>
    ${menu}
    ${helpSheet()}
    ${adminModal()}`;
}

function renderTabbar() {
  const pending = pendingChecks().length;
  const defects = openDefects().length;
  return TABS.map(t => {
    const on = nav.tab === t.id;
    let badge = '';
    if (t.id === 'queue' && pending) badge = `<span class="tab-badge">${pending}</span>`;
    if (t.id === 'defects' && defects) badge = `<span class="tab-badge is-quiet">${defects}</span>`;
    return `<button class="tab" data-a="tab" data-id="${t.id}" ${on ? 'aria-current="page"' : ''}>
      ${ICON[t.icon]}${badge}<span class="tab-label">${esc(t.label)}</span>
    </button>`;
  }).join('');
}

/* An insert that creates a field the user is meant to type into immediately
   (a new workshop, whose name is a placeholder) sets this to that field's
   data-fk. render() consumes it once and clears it — a one-shot, not state,
   so it does not belong in S and must never survive a second render. */
/* ------------------------------------------------------------- photos --- */

/* The eight walk-around shots, in the order they hang on the check. These
   labels are the KEYS of check.photos and S.cap.photos, so a stored id is filed
   under its label — reorder freely, but renaming one orphans old checks' ids. */
const SHOTS = ['FRONT', 'REAR', 'O/S', 'N/S', 'CAB', 'ODOMETER', 'LOAD', 'PLATE'];

/* What the tile actually reads. The keys above have to stay shouting because
   they are storage keys, but a tile caption is a label, not data, so it gets
   sentence case like every other label in the app. O/S and N/S keep their caps:
   offside and nearside are abbreviations on the page, not emphasis. */
const SHOT_LABEL = {
  FRONT: 'Front', REAR: 'Rear', 'O/S': 'O/S', 'N/S': 'N/S',
  CAB: 'Cab', ODOMETER: 'Odometer', LOAD: 'Load', PLATE: 'Plate'
};
const shotLabel = l => SHOT_LABEL[l] || l;

/* A phone photo is 2-4MB; a depot's worth would blow past IndexedDB and take an
   age to paint. Downscale to a ~1000px long edge and re-encode JPEG (~150KB)
   before anything is stored — the store only ever sees the small version. */
const PHOTO_MAX = 1000;
const PHOTO_QUALITY = 0.7;

function loadBitmap(file) {
  // createImageBitmap applies EXIF orientation where it exists; the <img>
  // fallback leans on the browser's default image-orientation handling.
  if (window.createImageBitmap) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadViaImg(file));
  }
  return loadViaImg(file);
}
function loadViaImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode failed')); };
    img.src = url;
  });
}
function downscale(file) {
  return loadBitmap(file).then(src => {
    const scale = Math.min(1, PHOTO_MAX / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    return new Promise((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', PHOTO_QUALITY));
  });
}

/* render() is synchronous; a blob read is not. So the markup carries
   <img data-photo-id> with no src, and this fills them a beat later from a cache
   of object URLs — cached so a re-render neither refetches nor flickers, and so
   the strip thumbnail and the enlarged view share one URL for the same id. */
const photoUrls = new Map();   // id -> objectURL, or the string 'pending'
const photoUrl = id => {
  const v = photoUrls.get(id);
  return v && v !== 'pending' ? v : null;
};
function hydratePhotos() {
  document.querySelectorAll('img[data-photo-id]').forEach(img => {
    const id = img.dataset.photoId;
    const ready = photoUrl(id);
    if (ready) { if (img.getAttribute('src') !== ready) img.src = ready; return; }
    if (photoUrls.get(id) === 'pending') return;
    photoUrls.set(id, 'pending');
    Photos.get(id).then(blob => {
      if (!blob) { photoUrls.delete(id); return; }
      const url = URL.createObjectURL(blob);
      photoUrls.set(id, url);
      document.querySelectorAll(`img[data-photo-id="${CSS.escape(id)}"]`).forEach(el => { el.src = url; });
    }).catch(() => photoUrls.delete(id));
  });
}

/* Enlarge one shot full-screen — a manager judging "too dark to countersign"
   needs it bigger than a strip thumbnail. A plain DOM overlay, deliberately
   outside S/render: it is transient and must sit above a re-render, not be part
   of the app's persisted state. Tap anywhere to close. */
function openPhoto(id) {
  const show = url => {
    const ov = document.createElement('div');
    ov.className = 'photo-view';
    const img = document.createElement('img');
    img.src = url; img.alt = '';
    ov.appendChild(img);
    ov.addEventListener('click', () => ov.remove());
    document.body.appendChild(ov);
  };
  const cached = photoUrl(id);
  if (cached) return show(cached);
  Photos.get(id).then(blob => {
    if (!blob) return toast('That photo isn’t on this phone.');
    const url = URL.createObjectURL(blob);
    photoUrls.set(id, url);
    show(url);
  });
}

/* --- Signature pad ------------------------------------------------------
   The manager's countersignature, drawn with a finger. render() rebuilds the
   DOM every time, so a fresh <canvas> can't keep its strokes — they live here
   as a data-URL and get painted back onto each new canvas by hydrateSig().
   Drawing never re-renders (a stroke is never interrupted); the one exception
   is the empty→signed moment, which fires a single render so the Countersign
   button can switch on. */
let sigData = null;         // PNG data-URL of the signature in progress, or null
let sigForCheckId = null;   // the check that signature belongs to
const sigReady = () => !!sigData;
function resetSig(checkId) { sigData = null; sigForCheckId = checkId || null; }

function hydrateSig() {
  const canvas = document.querySelector('canvas.sig-pad');
  if (!canvas) return;

  /* Ink held for a different check than the pad on screen is stale — drop it so
     nobody countersigns one check with a signature drawn on another. */
  const forId = canvas.dataset.check || null;
  if (forId !== sigForCheckId) { sigData = null; sigForCheckId = forId; }

  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;   // not laid out yet; next render will size it
  const dpr = window.devicePixelRatio || 1;
  const cssW = rect.width, cssH = rect.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1C2226';

  if (sigData) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, cssW, cssH);
    img.src = sigData;
  }

  let drawing = false, lastX = 0, lastY = 0;
  const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => {
    drawing = true; [lastX, lastY] = at(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const [x, y] = at(e);
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
    lastX = x; lastY = y;
    e.preventDefault();
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    const wasEmpty = !sigData;
    sigData = canvas.toDataURL('image/png');
    if (wasEmpty) invalidate();   // a single render, to switch the button on
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

/* A drawn signature is captured to the same IndexedDB blob store as the photos,
   so it shares their lifecycle (kept by gcPhotos, carried on the check). */
function sigToBlob() {
  if (!sigData) return Promise.resolve(null);
  return fetch(sigData).then(r => r.blob());
}

/* The camera/file picker is built in JS, not rendered into the markup: a file
   input reports its choice as `change`, and handle() only lets fields through on
   `input`, so a delegated one would never fire (same reason as item 21's backup
   picker). One reused input; value cleared after each pick so re-picking the
   same file still fires. */
let photoInput = null;
let photoTargetShot = null;
function pickPhoto(shot) {
  if (!photoInput) {
    photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.setAttribute('capture', 'environment');   // rear camera on a phone; ignored on desktop
    photoInput.style.display = 'none';
    photoInput.addEventListener('change', onPhotoPicked);
    document.body.appendChild(photoInput);
  }
  photoTargetShot = shot;
  photoInput.value = '';
  photoInput.click();
}
function onPhotoPicked() {
  const file = photoInput.files && photoInput.files[0];
  const shot = photoTargetShot;
  photoTargetShot = null;
  if (!file || !shot || !S.cap) return;
  downscale(file).then(blob => Photos.put(blob)).then(id => {
    if (!S.cap) { Photos.remove(id); return; }   // the walk ended while encoding
    const prev = S.cap.photos && S.cap.photos[shot];
    setCap({ photos: { ...(S.cap.photos || {}), [shot]: id } });
    if (prev && prev !== id) Photos.remove(prev);   // the shot it replaced is now an orphan
  }).catch(() => toast('Could not read that photo — try again.'));
}

/* Every photo id a discarded walk was holding, so its blobs don't outlive it.
   Call BEFORE cap is nulled. */
function releaseCapPhotos() {
  if (!S.cap || !S.cap.photos) return;
  Object.keys(S.cap.photos).forEach(k => {
    const id = S.cap.photos[k];
    if (id) { photoUrls.delete(id); Photos.remove(id); }
  });
}

/* ------------------------------------------------------------- render --- */

let focusNext = '';

/* Full re-render loses the caret. Snapshot which field was focused and where
   the cursor sat, then put it back — otherwise renaming a check is unusable. */
function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.dataset || !el.dataset.fk) return null;
  return { fk: el.dataset.fk, start: el.selectionStart, end: el.selectionEnd };
}
function restoreFocus(snap) {
  if (!snap) return;
  const el = document.querySelector(`[data-fk="${CSS.escape(snap.fk)}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { el.setSelectionRange(snap.start, snap.end); } catch (_) { /* not a text field */ }
}

function render() {
  /* A depot with nobody on it has never been set up: no signer is possible, so
     no normal screen can do anything. The setup screen pre-empts the whole nav
     stack until the first person — the hidden admin — exists. */
  const screen = needsSetup() ? 'setup' : currentScreen();
  const def = SCREENS[screen];
  const snap = captureFocus();
  const scroller = document.getElementById('screen');
  const keepScroll = scroller.scrollTop;

  document.getElementById('topbar').innerHTML = renderTopbar(screen);
  scroller.className = cls('screen', transition);
  scroller.innerHTML = def.view();

  /* The one screen that hides the tabs. Signed out, "Who are you?" is a gate:
     offering Queue/Defects/Vans underneath it invites you to walk away from
     the only question on screen, and a check walked with nobody signed in is a
     check with a blank inspector. Signed in it is an ordinary pushed screen
     you reached by choice, so the tabs stay. `hidden` collapses the grid row
     outright — see `.tabbar[hidden]` in the CSS, which the class's own
     `display: grid` would otherwise beat. */
  const tabbar = document.getElementById('tabbar');
  const gate = screen === 'setup' || (screen === 'whoami' && !me());
  tabbar.hidden = gate;
  tabbar.innerHTML = gate ? '' : renderTabbar();

  // A transition means a new screen: start at the top. Otherwise the user is
  // mid-task on the same screen and must not be yanked around.
  scroller.scrollTop = transition ? 0 : keepScroll;
  transition = '';
  restoreFocus(snap);

  /* Claim beats restore: the row that was just created is where the user is
     going, not wherever the caret happened to be. The whole placeholder is
     selected so the first keystroke replaces it instead of appending to it. */
  if (focusNext) {
    const fresh = document.querySelector(`[data-fk="${CSS.escape(focusNext)}"]`);
    focusNext = '';
    if (fresh) {
      fresh.focus({ preventScroll: true });
      try { fresh.select(); } catch (_) { /* not a text field */ }
    }
  }

  // Fill any <img data-photo-id> the new markup carries, from the blob cache.
  hydratePhotos();
  // Wire the countersignature pad if this screen has one.
  hydrateSig();
  // A new screen resets scrollTop, so the header's elevation has to be re-read.
  syncHeaderLift();
}

/* The header sits flat while the screen is at the top and lifts — deeper
   shadow — the moment anything has scrolled under it. That reaction is the
   difference between chrome that reads as a layer and a banner that reads as
   the first block of the page.

   It toggles a CLASS rather than writing a style, so both looks stay in the
   stylesheet; it writes only when the boolean actually flips, so a momentum
   flick does not queue a hundred identical DOM writes; and the listener is
   registered passive, because a non-passive scroll listener is on its own
   enough to make an iOS list feel like it is dragging. */
let headerLifted = false;
function syncHeaderLift() {
  const scroller = document.getElementById('screen');
  const bar = document.getElementById('topbar');
  if (!scroller || !bar) return;
  const lift = scroller.scrollTop > 1;
  if (lift === headerLifted) return;
  headerLifted = lift;
  bar.classList.toggle('is-lifted', lift);
}

/* One action can touch S and several Store collections, and Store fires a
   change per write. Coalesce to a single render at the end of the tick. */
let renderQueued = false;
let booted = false;
function invalidate() {
  if (!booted || renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; render(); });
}

/* ------------------------------------------------------------ navigation -- */

function push(screen) {
  nav.stack.push(screen);
  history.pushState({ depth: nav.stack.length }, '');
  transition = 'is-push';
  invalidate();
}
function goTab(tab) {
  if (nav.tab === tab && !nav.stack.length) {
    document.getElementById('screen').scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  /* An armed destructive button must never still be waiting when the user
     comes back to the screen — leaving disarms it. */
  if (S.capArmDiscard) { S = { ...S, capArmDiscard: false }; save(); }
  if (S.armDelPerson || S.armDelVan) { S = { ...S, armDelPerson: '', armDelVan: '' }; save(); }
  /* Same for a half-typed draw rule: it was never valid enough to save, so the
     field must come back showing the rule that is actually in force, not the
     stale keystrokes somebody wandered off mid-edit. */
  if (Object.keys(S.ruleDraft).length) { S = { ...S, ruleDraft: {} }; save(); }
  /* And a staged restore: coming back to More should not find a red card still
     poised over the depot from whenever it was last opened. */
  if (S.importSum) { pendingImport = null; S = { ...S, importSum: null }; save(); }
  nav = { tab, stack: [] };
  history.replaceState({ depth: 0 }, '');
  transition = '';
  invalidate();
}
window.addEventListener('popstate', e => {
  const depth = (e.state && e.state.depth) || 0;
  if (nav.stack.length > depth) {
    /* Backing out of Settings must not leave a restore staged and unseen —
       the red "replaces everything" card only shows there. */
    if (S.importSum) { pendingImport = null; S = { ...S, importSum: null }; save(); }
    // Backing off a screen disarms whatever was one tap from deleting on it.
    if (S.armDelPerson || S.armDelVan) { S = { ...S, armDelPerson: '', armDelVan: '' }; save(); }
    /* Coverage is reached by push now, not by a tab switch, so the half-typed
       draw rule that goTab used to discard has to be discarded here too — or
       the field comes back showing keystrokes that were never in force. */
    if (Object.keys(S.ruleDraft).length) { S = { ...S, ruleDraft: {} }; save(); }
    /* A hardware/gesture back fires no tap, so the dispatcher never sees it —
       the identity menu has to be shut here or it hangs over the screen the
       back landed on. */
    if (S.whoMenu) { S = { ...S, whoMenu: false }; save(); }
    if (S.help) { S = { ...S, help: '' }; save(); }
    nav.stack.length = depth;
    transition = 'is-pop';
    invalidate();
  }
});

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-up');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-up'), 2200);
}

/* --------------------------------------------------------------- actions -- */

const cycle = (idx, len) => (idx + 1) % len;
/* Cycle a value through a list of strings rather than storing an index —
   the stored record must survive the list being reordered. */
const nextIn = (list, value) => {
  const i = list.indexOf(value);
  return list[(i < 0 ? 0 : i + 1) % list.length];
};
const vanDraft = v => ({ id: v.id, reg: v.reg, model: v.model, status: v.status, bay: v.bay || '', motDue: v.motDue || '' });

/* The draft check. Names are copied in alongside the ids because a check is a
   document: it has to still read correctly in a year, after the person has
   left and their record has been made dormant or renamed. */
const newCap = () => {
  /* Whoever is signed in is almost always the one about to walk the van, so
     "Walked by" starts on them. It is a default, not a lock — capture-start
     still offers the whole crew, and a manager walking a van themselves is
     ordinary. Nobody signed in leaves it blank, as before. */
  const signer = me();
  return {
    vanId: '',
    inspectorId: signer ? signer.id : '', inspectorName: signer ? signer.name : '',
    secondId: '', secondName: '',
    mileage: '', startedAt: '', secIdx: 0, res: {}, photos: {}
  };
};
const setCap = patch => set({ cap: { ...S.cap, ...patch } });
const capEntry = id => capAll().filter(e => e.it.id === id)[0] || null;
const setRes = (id, patch) => {
  const e = capEntry(id);
  if (!e) return;
  const cur = S.cap.res[id] || blankRes(e.it);
  setCap({ res: { ...S.cap.res, [id]: { ...cur, ...patch } } });
};
/* A fail starts from the safest reading of it: a critical item is major and
   presumed undriveable until the inspector says otherwise. Defaults are only
   applied to a fresh fail — never over an answer already given. */
const failDefaults = (it, cur) => {
  const p = { severity: cur.severity || (it.crit ? 'major' : 'minor') };
  if (cur.safeToDrive === null) p.safeToDrive = !it.crit;
  return p;
};

const ACTIONS = {
  tab: (_, el) => goTab(el.dataset.id),
  back: () => history.back(),

  /* A "no fleet yet" state offers to fix the fleet, and the fleet tab with
     nothing on it is only the same emptiness said twice. So go one screen
     further and open the form itself, leaving the fleet list under the back
     gesture — which is where saving lands you. */
  addFirstVan: () => { goTab('vans'); ACTIONS.startAdd(); },

  /* draw -------------------------------------------------------------- */

  /* One action for both "pick" and "pick another", because they are the same
     act — the only difference is whether a draw is already standing, and that
     is a question about the pool, not about which button was pressed.

     `rolls` counts from the draw that is still live. If the standing van has
     left the pool (it was walked, retired, put off road), this is a fresh run
     and the counter goes back to zero along with the memory of what has been
     offered — otherwise a depot that draws every morning would run out of
     re-rolls by Wednesday and never get them back. */
  drawVan: () => {
    const pool = drawPool();
    if (!pool.rows.length) return;
    const standing = pool.rows.filter(r => r.van.id === S.draw.vanId)[0] || null;
    if (standing && S.draw.rolls >= drawRules().rerolls) return;
    const row = pickRow(pool);
    if (!row) return;
    set({ draw: standing
      ? { vanId: row.van.id, rolls: S.draw.rolls + 1, seen: S.draw.seen.concat([row.van.id]) }
      : { vanId: row.van.id, rolls: 0, seen: [row.van.id] } });
  },
  /* The drawn van is a starting point, not a completed setup: who is walking
     it, the second pair of eyes and the odometer are all still unanswered, so
     this lands on capture-start with the van already filled rather than
     dropping straight into the checklist. */
  drawStart: () => {
    const van = Store.get('vans', S.draw.vanId);
    if (!van) return;
    S = { ...S, cap: { ...newCap(), vanId: van.id }, capArmDiscard: false };
    save();
    push('capture-start');
  },
  openDraw: () => push('draw'),
  /* A dead button that says why it is dead, rather than one that ignores the
     tap and leaves you wondering whether it registered. */
  noReroll: () => toast('That’s every re-roll for this draw. Change the limit in Settings if it’s too tight.'),

  /* capture ----------------------------------------------------------- */
  startCapture: () => {
    // A half-walked check is real work — resume it rather than offer a new one.
    if (S.cap && S.cap.startedAt) {
      set({ capArmDiscard: false });
      return push('capture');
    }
    // A draft that never started is an abandoned setup screen; replacing it
    // loses nothing.
    S = { ...S, cap: newCap(), capArmDiscard: false };
    save();
    push('capture-start');
  },
  /* Discarding from the queue: no navigation, and never on one tap. The walk's
     photos go with it — nothing submitted means no blobs left behind. */
  capDiscard: () => {
    if (!S.capArmDiscard) return set({ capArmDiscard: true });
    releaseCapPhotos();
    S = { ...S, cap: null, capArmDiscard: false };
    save();
    invalidate();
    toast('Walk discarded. Nothing was submitted.');
  },
  capPickVan: (_, el) => setCap({ vanId: el.value }),
  capPickInspector: (_, el) => {
    const p = Store.get('people', el.value);
    setCap({
      inspectorId: el.value, inspectorName: p ? p.name : '',
      // Nobody is their own second pair of eyes.
      secondId: S.cap.secondId === el.value ? '' : S.cap.secondId,
      secondName: S.cap.secondId === el.value ? '' : S.cap.secondName
    });
  },
  capPickSecond: (_, el) => {
    const p = Store.get('people', el.value);
    setCap({ secondId: el.value, secondName: p ? p.name : '' });
  },
  capMileage: (_, el) => setCap({ mileage: el.value.replace(/[^0-9]/g, '') }),
  capAbandon: () => {
    releaseCapPhotos();   // in practice empty here (photos come later), but never orphan
    S = { ...S, cap: null };
    save();
    history.back();
  },
  /* Photos ----------------------------------------------------------- */
  capPhoto: (_, el) => pickPhoto(el.dataset.shot),
  capPhotoRemove: (_, el) => {
    const shot = el.dataset.shot;
    const id = S.cap.photos && S.cap.photos[shot];
    const photos = { ...(S.cap.photos || {}) };
    delete photos[shot];
    setCap({ photos });
    if (id) { photoUrls.delete(id); Photos.remove(id); }
  },
  viewPhoto: (_, el) => openPhoto(el.dataset.photoId),
  capBegin: () => {
    if (!S.cap || !capVan() || !S.cap.inspectorId) return;
    setCap({ startedAt: Store.now(), secIdx: 0 });
    push('capture');
  },
  capSet: (_, el) => {
    const id = el.dataset.id, v = el.dataset.v;
    const e = capEntry(id);
    if (!e) return;
    const it = e.it, cur = S.cap.res[id] || blankRes(it);
    /* Tapping the answer that is already given takes it back off. For a
       measured item that means falling back to what the readings say, not to
       blank — the numbers are still on the screen. */
    if (cur.outcome === v) {
      return setRes(id, { outcome: it.type === 'm' ? measuredOutcome(it, cur.values) : '' });
    }
    setRes(id, { outcome: v, ...(v === 'fail' ? failDefaults(it, cur) : {}) });
  },
  capReading: (_, el) => {
    const id = el.dataset.id, i = Number(el.dataset.i);
    const e = capEntry(id);
    if (!e) return;
    const it = e.it, cur = S.cap.res[id] || blankRes(it);
    const values = cur.values.slice();
    values[i] = el.value;
    const patch = { values };
    // An explicit N/A stands; anything else follows the numbers.
    if (cur.outcome !== 'na') {
      patch.outcome = measuredOutcome(it, values);
      if (patch.outcome === 'fail') Object.assign(patch, failDefaults(it, cur));
    }
    setRes(id, patch);
  },
  capSeverity: (_, el) => setRes(el.dataset.id, { severity: el.dataset.v }),
  capSafe: (_, el) => {
    const r = capRes(el.dataset.id);
    setRes(el.dataset.id, { safeToDrive: !(r && r.safeToDrive === false) ? false : true });
  },
  capNote: (_, el) => setRes(el.dataset.id, { note: el.value }),
  capPrevSec: () => setCap({ secIdx: Math.max(0, S.cap.secIdx - 1) }),
  capNextSec: () => setCap({ secIdx: Math.min(capSections().length - 1, S.cap.secIdx + 1) }),
  capReview: () => push('capture-review'),
  capBackToWalk: () => history.back(),
  /* Jumping to the section holding the gap, from the review screen. */
  capGoTo: (_, el) => {
    const i = capSections().map(s => s.id).indexOf(el.dataset.id);
    setCap({ secIdx: i < 0 ? 0 : i });
    if (currentScreen() === 'capture-review') history.back();
  },
  capSubmit: () => {
    if (!capReady()) return;
    const c = S.cap, van = capVan();

    /* The check is written in checklist order, with the section name and the
       item name copied onto each row. The checklist will be edited again; a
       finished check must not change shape when it is. */
    const results = capAll().map(e => {
      const r = capRes(e.it.id);
      const failed = r.outcome === 'fail';
      return {
        itemId: e.it.id, name: e.it.name, sectionName: e.sec.name, crit: !!e.it.crit,
        outcome: r.outcome,
        values: e.it.type === 'm' ? r.values.map(v => (v === '' ? null : Number(v))) : [],
        note: (r.note || '').trim(),
        severity: failed ? (r.severity || 'minor') : '',
        safeToDrive: failed ? r.safeToDrive !== false : null
      };
    });
    const failed = results.filter(r => r.outcome === 'fail').length;
    const passed = results.filter(r => r.outcome === 'pass').length;

    const check = Store.insert('checks', {
      vanId: c.vanId, reg: van ? van.reg : '',
      inspectorId: c.inspectorId, inspectorName: c.inspectorName, secondName: c.secondName || '',
      startedAt: c.startedAt || Store.now(), finishedAt: Store.now(),
      mileage: c.mileage === '' ? null : Number(c.mileage),
      results, passed, failed,
      // Only the ids travel onto the record; the blobs are already in IndexedDB.
      photos: { ...(c.photos || {}) },
      decision: null, decidedAt: null, decidedBy: null, returnNote: ''
    });
    if (c.vanId) Store.update('vans', c.vanId, { lastCheckOn: Store.today() });

    // The draft is gone the moment it becomes a record — there is only one of it.
    S = { ...S, cap: null, selectedId: check.id };
    save();
    goTab('queue');
    toast(failed
      ? (van ? van.reg + ' submitted. ' : 'Submitted. ') + failed + (failed === 1 ? ' defect waiting on a countersign.' : ' defects waiting on a countersign.')
      : (van ? van.reg + ' submitted clean.' : 'Submitted clean.'));
  },

  /* queue ------------------------------------------------------------- */
  openCheck: (_, el) => {
    S = { ...S, selectedId: el.dataset.id, sendingBack: false, assigneeId: '', dueOn: '', offRoad: false, sbReason: null, sbScope: 0, sbHold: true, sbNote: '' };
    resetSig(el.dataset.id);   // a fresh pad for this check
    save();
    push('check');
  },
  clearSig: () => { resetSig(sigForCheckId); invalidate(); },
  pickAssignee: (_, el) => set({ assigneeId: el.value }),
  /* pickDue / editMot are NOT here — a native date field must not be rebuilt on
     every keystroke (it drops focus off the segment being typed, which is what
     broke typing the year). They are written quietly by the input listener; the
     past-date rule is enforced by dueValid()/approve, not by clamping mid-type. */
  toggleOffRoad: () => set({ offRoad: !S.offRoad }),
  sendBack: () => {
    const sel = selectedCheck();
    if (!sel) return;
    // The button is already disabled without a manager; this is the same rule
    // stated where the record is actually written, not only where it is drawn.
    if (!isManager()) { toast('Choose who you are before deciding a check.'); return; }
    // Tapping "sent back" on an already-returned check undoes the decision.
    if (sel.decision === 'sent-back') {
      Store.update('checks', sel.id, { decision: null, decidedAt: null, decidedBy: null, returnNote: '', returnScope: 0, returnHold: false });
      return set({ sendingBack: false });
    }
    set({ sendingBack: !S.sendingBack });
  },
  approve: () => {
    const sel = selectedCheck();
    if (!sel || sel.decision) return;
    if (!isManager()) { toast('Choose who you are before countersigning.'); return; }
    const fails = failedResults(sel);
    if (fails.length && !assignReady()) return;
    if (!sigReady()) { toast('Add your signature to countersign.'); return; }

    // The signature is a blob like a photo. Store it first, then write the check
    // pointing at it — so a countersigned record always resolves to a real id.
    const finish = signatureId => {
      Store.update('checks', sel.id, {
        decision: 'countersigned', decidedAt: Store.now(), decidedBy: meName(),
        signatureId: signatureId || ''
      });

      // Countersigning is what turns a failed check item into a real defect —
      // one defect per failed item, all to the workshop and date just picked.
      const shop = pickedShop();
      fails.forEach(res => {
        Store.insert('defects', {
          checkId: sel.id, vanId: sel.vanId, reg: sel.reg,
          name: res.name, severity: res.severity || 'minor', note: res.note || '',
          stage: 'awaiting', safeToDrive: res.safeToDrive == null ? null : res.safeToDrive,
          workshopId: shop ? shop.id : '', raisedOn: Store.today(), dueOn: S.dueOn,
          repairedOn: '', recheckedBy: '', closedOn: ''
        });
      });
      if (S.offRoad && sel.vanId) Store.update('vans', sel.vanId, { status: 'offroad' });

      resetSig(null);
      set({ sendingBack: false });
      toast(fails.length
        ? 'Countersigned. ' + (fails.length === 1 ? 'Job raised' : fails.length + ' jobs raised') + ' and re-check scheduled.'
        : 'Countersigned.');
    };

    sigToBlob()
      .then(blob => (blob && window.Photos ? Photos.put(blob) : ''))
      .then(finish)
      .catch(() => finish(''));   // a signature that won't encode shouldn't block the sign-off
  },
  sbReason: (_, el) => set({ sbReason: Number(el.dataset.i) }),
  sbScope: (_, el) => set({ sbScope: Number(el.dataset.i) }),
  sbToggleHold: () => set({ sbHold: !S.sbHold }),
  sbCancel: () => set({ sendingBack: false }),
  sbConfirm: () => {
    const canSend = S.sbReason !== null && (S.sbReason !== 5 || S.sbNote.trim().length > 2);
    if (!canSend) return;
    const sel = selectedCheck();
    if (!sel) return;
    if (!isManager()) { toast('Choose who you are before deciding a check.'); return; }
    const reason = S.sbReason === 5 ? S.sbNote.trim() : REASONS[S.sbReason];
    Store.update('checks', sel.id, {
      decision: 'sent-back', decidedAt: Store.now(), decidedBy: meName(),
      returnNote: reason, returnScope: S.sbScope, returnHold: S.sbHold
    });
    set({ sendingBack: false });
    toast('Sent back to ' + sel.inspectorName + '.');
  },

  /* defects ----------------------------------------------------------- */
  defectAction: (_, el) => {
    const d = Store.get('defects', el.dataset.id);
    if (!d) return;
    const verified = d.stage === 'verified';
    Store.update('defects', d.id, verified
      ? { stage: 'closed', closedOn: Store.today() }
      : { stage: 'awaiting' });
    toast(verified ? 'Defect closed.' : 'Re-check scheduled with the workshop.');
  },

  /* coverage ---------------------------------------------------------- */
  editRule: (_, el) => {
    const rule = RULES.filter(r => r.key === el.dataset.id)[0];
    if (!rule) return;
    const raw = el.value.trim();
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    const draft = { ...S.ruleDraft };
    /* Out of range, or mid-clear, and the rule in force is left exactly as it
       was. A "1" typed on the way to "14" must never briefly become the live
       exclusion window, and an empty field must never be read as zero. */
    if (!Number.isFinite(n) || n < rule.min || n > rule.max) {
      draft[rule.key] = el.value;
      set({ ruleDraft: draft });
      return;
    }
    delete draft[rule.key];
    Store.setSettings({ [rule.key]: n });
    set({ ruleDraft: draft });
  },
  exportWeek: () => {
    const weekAgo = shiftDays(Store.today(), -7);
    const rows = doneChecks()
      .filter(c => dayOf(c.finishedAt) > weekAgo)
      .sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
    if (!rows.length) { toast('Nothing was finished this week — nothing to export.'); return; }
    /* Quote every cell and double the quotes inside it: a return note is free
       text and will eventually hold a comma, a quote, or a line break. */
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['Date', 'Van', 'Odometer', 'Inspector', 'Second', 'Passed', 'Failed', 'Decision', 'Note'];
    const csv = [head].concat(rows.map(c => [
      dayOf(c.finishedAt), c.reg, c.mileage == null ? '' : c.mileage,
      c.inspectorName, c.secondName || '', c.passed, c.failed,
      c.decision || 'pending', c.returnNote || ''
    ])).map(r => r.map(q).join(',')).join('\r\n');
    /* Built on the phone and handed straight to the browser: there is no server
       to post this to, and a depot that wants the file wants it now. The BOM is
       for Excel, which otherwise reads a UK reg's accented notes as mojibake. */
    const BOM = String.fromCharCode(0xFEFF);
    const url = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spot-checks-' + Store.today() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(rows.length + (rows.length === 1 ? ' check' : ' checks') + ' saved to your downloads.');
  },

  /* vans -------------------------------------------------------------- */
  cycleFilter: () => set({ filterIdx: cycle(S.filterIdx, FILTERS.length) }),
  startAdd: () => {
    // Blank, not pre-filled: a guessed model that nobody corrects is worse
    // than a gap somebody notices.
    S = { ...S, adding: true, vanSelId: null, draft: { id: null, reg: '', model: '', status: 'active', bay: '', motDue: '' } };
    save();
    push('van');
  },
  openVan: (_, el) => {
    const v = Store.get('vans', el.dataset.id);
    if (!v) return;
    S = { ...S, vanSelId: v.id, adding: false, draft: vanDraft(v) };
    save();
    push('van');
  },
  editReg: (_, el) => {
    /* Every UK plate and every paper form shouts the reg in capitals. Fold it
       here so "kx21 hvd" and "KX21 HVD" can't become two vans — and put the
       caret back, because rewriting .value moves it to the end. */
    const up = el.value.toUpperCase();
    if (up !== el.value) {
      const at = el.selectionStart;
      el.value = up;
      try { el.setSelectionRange(at, at); } catch (_) { /* not selectable */ }
    }
    set({ draft: { ...S.draft, reg: up } });
  },
  editModel: (_, el) => set({ draft: { ...S.draft, model: el.value } }),
  editBay: (_, el) => set({ draft: { ...S.draft, bay: el.value } }),
  /* editMot: see the input listener — written quietly, same reason as pickDue. */
  setStatus: (_, el) => set({ draft: { ...S.draft, status: el.dataset.id } }),
  delVan: () => {
    const van = S.draft.id ? Store.get('vans', S.draft.id) : null;
    if (!van) return;
    // Re-checked here, not just where the button is drawn: a check could have
    // landed on this van between the arming tap and the confirming one.
    if (Store.count('checks', c => c.vanId === van.id) || Store.count('defects', d => d.vanId === van.id)) {
      set({ armDelVan: '' });
      toast(van.reg + ' has history now — retire it instead.');
      return;
    }
    if (S.armDelVan !== van.id) return set({ armDelVan: van.id });
    Store.remove('vans', van.id);
    S = { ...S, armDelVan: '', adding: false, vanSelId: null };
    save();
    toast(van.reg + ' deleted.');
    history.back();
  },
  cancelVan: () => {
    if (S.adding) { set({ adding: false }); history.back(); return; }
    const saved = Store.get('vans', S.draft.id);
    if (saved) set({ draft: vanDraft(saved) });
    toast('Reverted to the saved van.');
  },
  saveVan: () => {
    const d = S.draft;
    // Trim on the way to disk, not on every keystroke — typing a space
    // mid-name is normal and shouldn't fight the caret.
    const fields = {
      reg: d.reg.trim(), model: d.model.trim(), status: d.status,
      bay: d.bay.trim(), motDue: d.motDue
    };
    if (!fields.reg) return;
    if (S.adding) {
      const v = Store.insert('vans', { ...fields, lastCheckOn: '' });
      /* Back to the fleet list, not the van that was just typed: the form has
         nothing left to say about it, and the list is the proof it landed. */
      set({ adding: false, vanSelId: v.id, draft: { ...d, ...fields, id: v.id } });
      toast(fields.reg + ' added to the fleet.');
      history.back();
    } else {
      Store.update('vans', d.id, fields);
      toast('Saved.');
    }
  },

  /* more -------------------------------------------------------------- */
  openChecklist: () => push('checklist'),
  openHistory: () => push('history'),
  openPeople: () => push('people'),
  openWorkshops: () => push('workshops'),
  openSettings: () => push('settings'),
  /* Written straight through on every keystroke, like renameWorkshop — there is
     one depot and no Save button to hold a draft against. Raw, not trimmed: see
     depotName(), which does the trimming where it is read. */
  editDepotName: (_, el) => Store.setSettings({ depotName: el.value }),
  openCoverage: () => push('coverage'),
  exportBackup: () => {
    const db = Store.snapshot();
    const payload = { app: BACKUP_APP, format: 1, exportedAt: Store.now(), db };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spot-check-backup-' + Store.today() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const c = backupCounts(db);
    toast(c.vans + (c.vans === 1 ? ' van and ' : ' vans and ') +
      c.checks + (c.checks === 1 ? ' check' : ' checks') + ' saved to your downloads.');
  },
  importPick: () => {
    if (!filePicker) {
      filePicker = document.createElement('input');
      filePicker.type = 'file';
      filePicker.accept = 'application/json,.json';
      filePicker.style.display = 'none';
      filePicker.addEventListener('change', () => {
        const file = filePicker.files && filePicker.files[0];
        // Clear it straight away, or picking the same file twice in a row is
        // not a change and the second pick never arrives.
        filePicker.value = '';
        if (!file) return;
        file.text().then(text => {
          const res = readBackup(text);
          if (res.error) { pendingImport = null; set({ importSum: null }); toast(res.error); return; }
          pendingImport = res.db;
          set({ importSum: {
            name: file.name, exportedAt: res.exportedAt,
            schema: res.db.schema, counts: backupCounts(res.db)
          } });
        }).catch(() => toast('That file could not be read.'));
      });
      document.body.appendChild(filePicker);
    }
    filePicker.click();
  },
  importCancel: () => { pendingImport = null; set({ importSum: null }); },
  importConfirm: () => {
    if (!pendingImport) return;
    const c = backupCounts(pendingImport);
    Store.import(pendingImport);
    pendingImport = null;
    /* Everything in S points at the old depot — a selected van, a half-walked
       check, a checklist draft — and none of those ids exist any more. Start
       the UI over rather than leave it holding references to nothing. */
    S = { ...freshState(), list: publishedList() };
    save();
    nav = { tab: 'more', stack: [] };
    history.replaceState({ depth: 0 }, '');
    invalidate();
    toast('Restored ' + c.vans + (c.vans === 1 ? ' van, ' : ' vans, ') +
      c.checks + (c.checks === 1 ? ' check' : ' checks') + ' and the checklist.');
  },
  resetAll: () => {
    if (!S.armReset) return set({ armReset: true });
    Store.reset({ seed: SEED });
    // freshState leaves the draft null; the reset has just re-seeded the
    // template, so take a working copy of it the way load() would.
    S = { ...freshState(), list: publishedList() };
    save();
    nav = { tab: 'more', stack: [] };
    history.replaceState({ depth: 0 }, '');
    invalidate();
    toast('Depot emptied. Checklist back to the template.');
  },

  /* checklist --------------------------------------------------------- */
  openSection: (_, el) => { S = { ...S, secIdx: Number(el.dataset.i), openId: null }; save(); push('section'); },
  renameSection: (_, el) => { const v = el.value, i = Number(el.dataset.i); editSecs(l => { l[i].name = v; }); },
  secUp: (_, el) => {
    const i = Number(el.dataset.i);
    if (i <= 0) return;
    editSecs(l => { const [m] = l.splice(i, 1); l.splice(i - 1, 0, m); return { secIdx: S.secIdx === i ? i - 1 : S.secIdx === i - 1 ? i : S.secIdx, openId: null }; });
  },
  secDown: (_, el) => {
    const i = Number(el.dataset.i);
    if (i >= S.list.length - 1) return;
    editSecs(l => { const [m] = l.splice(i, 1); l.splice(i + 1, 0, m); return { secIdx: S.secIdx === i ? i + 1 : S.secIdx === i + 1 ? i : S.secIdx, openId: null }; });
  },
  retireSection: () => editSecs(l => { if (l[S.secIdx]) l[S.secIdx].retired = !l[S.secIdx].retired; }),
  addSection: () => {
    const n = S.addCount + 1;
    editSecs(l => { l.push({ id: 'ns' + n, name: 'New section ' + n, retired: false, items: [] }); return { secIdx: l.length - 1, addCount: n, openId: null }; });
    push('section');
  },
  publish: () => {
    if (!isDirty()) return;
    const v = checklistVersion() + 1;
    // The draft becomes the published list, in one write — a half-published
    // checklist is worse than an out-of-date one.
    Store.replace('checklist', S.list);
    Store.setSettings({ checklistVersion: v, checklistPublishedOn: Store.today() });
    set({ list: publishedList() });
    toast('Published v' + v + '. Phones pick it up on next sync.');
  },
  revertList: () => {
    if (!isDirty()) return;
    set({ list: publishedList(), openId: null });
    toast('Changes discarded.');
  },

  /* checklist items ---------------------------------------------------- */
  openItem: (_, el) => set({ openId: S.openId === el.dataset.id ? null : el.dataset.id }),
  renameItem: (_, el) => { const v = el.value, i = Number(el.dataset.i); editList(items => { items[i].name = v; }); },
  setHint: (_, el) => { const v = el.value, i = Number(el.dataset.i); editList(items => { items[i].hint = v; }); },
  toggleCrit: (_, el) => { const i = Number(el.dataset.i); editList(items => { items[i].crit = !items[i].crit; }); },
  retireItem: (_, el) => { const i = Number(el.dataset.i); editList(items => { items[i].retired = !items[i].retired; }); },
  itemUp: (_, el) => { const i = Number(el.dataset.i); if (i > 0) editList(items => { const [m] = items.splice(i, 1); items.splice(i - 1, 0, m); }); },
  itemDown: (_, el) => { const i = Number(el.dataset.i); editList(items => { if (i < items.length - 1) { const [m] = items.splice(i, 1); items.splice(i + 1, 0, m); } }); },
  setPF: (_, el) => { const i = Number(el.dataset.i); editList(items => { items[i].type = 'pf'; }); },
  setM: (_, el) => { const i = Number(el.dataset.i); editList(items => { items[i].type = 'm'; }); },
  cycleUnit: (_, el) => { const i = Number(el.dataset.i); editList(items => { items[i].unit = UNITS[cycle(UNITS.indexOf(items[i].unit), UNITS.length)]; }); },
  cycleParts: (_, el) => { const i = Number(el.dataset.i); editList(items => { items[i].parts = cycle(items[i].parts, PARTS.length); }); },
  cycleDir: (_, el) => { const i = Number(el.dataset.i); editList(items => { items[i].dir = items[i].dir === 'below' ? 'above' : 'below'; }); },
  limitDown: (_, el) => bump(Number(el.dataset.i), 'limit', -1),
  limitUp: (_, el) => bump(Number(el.dataset.i), 'limit', 1),
  warnDown: (_, el) => bump(Number(el.dataset.i), 'warn', -1),
  warnUp: (_, el) => bump(Number(el.dataset.i), 'warn', 1),
  addItem: () => {
    const n = S.addCount + 1;
    S = { ...S, addCount: n };
    editList(items => {
      items.push({ id: 'new' + n, name: 'New check ' + n, crit: false, hint: '', retired: false, added: true, type: 'pf', unit: 'mm', parts: 0, limit: 1, warn: 2, dir: 'below' });
    });
  },

  /* who am I ---------------------------------------------------------- */
  /* Signed in: the avatar is a menu button, and tapping it again shuts the
     menu rather than stacking a second one. Signed out: no menu, straight to
     the screen — see the note in renderTopbar. */
  /* The avatar survives on the signed-out gate screen (it is the only thing
     left on that header), so it has to stop pushing a second copy of the
     screen you are already looking at. */
  openWho: () => {
    if (me()) return set({ whoMenu: !S.whoMenu });
    if (currentScreen() !== 'whoami') push('whoami');
  },
  closeWhoMenu: () => set({ whoMenu: false }),
  /* Unknown key opens nothing rather than an empty sheet — helpSheet() draws ''
     for anything HELP has no entry for, so this stays a no-op by construction. */
  openHelp: (_, el) => set({ help: el.dataset.id || '', whoMenu: false }),
  closeHelp: () => set({ help: '' }),
  whoSwitch: () => { set({ whoMenu: false }); push('whoami'); },
  beMe: (_, el) => {
    const p = Store.get('people', el.dataset.id);
    if (!p || !p.active) return;
    set({ userId: p.id });
    toast('Signed in as ' + p.name + '.');
    history.back();
  },
  signOut: () => {
    /* The depot is untouched — only the name this phone signs with is cleared.
       A half-walked check is left alone on purpose: it already carries the
       inspector's id and name, so it is that person's work whoever picks the
       phone up next, and throwing it away would lose a real walk. */
    set({ userId: '', whoMenu: false });
    toast('Signed out. Nothing else was changed.');
    /* And it has to LAND on the gate screen. Clearing the name in place left
       the phone sitting on the Queue looking almost identical — the only tell
       was the avatar going grey — so signing out read as having done nothing,
       and reaching the sign-in list meant a second trip to the avatar. Signing
       out ends with the one screen that can undo it. The guard is for the Who
       screen's own docked Sign out: it is already here, and pushing a second
       copy of the screen you are looking at is what P4-16 fixed on the avatar. */
    if (currentScreen() !== 'whoami') push('whoami');
  },

  /* admin & setup ----------------------------------------------------- */
  /* Reached from the setup screen's CTA, and from "+ Add an admin" in the
     hidden admin area. Opens the one modal in the app onto a fresh name. */
  openAdminModal: () => {
    focusNext = 'admin-name';
    set({ adminModal: true, adminName: '' });
  },
  /* Half-typed name held in S so the disabled state of Create can react to it;
     the caret survives the re-render through the field's data-fk, same as every
     other live-edited field. */
  editAdminName: (_, el) => set({ adminName: el.value }),
  closeAdminModal: () => set({ adminModal: false, adminName: '' }),
  /* Mint the admin. On the very first run nobody is signed in, so this is the
     bootstrap: sign the new admin in and drop them on More, where the depot is
     actually set up. Adding a SECOND admin later (from the admin area, already
     signed in) only appends — it must not silently switch who this phone is. */
  createAdmin: () => {
    const name = S.adminName.trim();
    if (!name) return;
    const firstRun = !me();
    const p = Store.insert('people', { name, role: 'admin', active: true, pinSetOn: '' });
    if (firstRun) { nav = { tab: 'more', stack: [] }; history.replaceState({ depth: 0 }, ''); }
    set(firstRun
      ? { adminModal: false, adminName: '', userId: p.id }
      : { adminModal: false, adminName: '' });
    toast(firstRun ? 'Admin created. Set the depot up from here.' : name + ' added as an admin.');
  },
  /* The discreet way into the hidden admin area, from Settings and the sign-in
     gate. Guarded like openWho so it never pushes a second copy of itself. */
  openAdmin: () => { if (currentScreen() !== 'admin') push('admin'); },

  /* people ------------------------------------------------------------ */
  renamePerson: (_, el) => Store.update('people', el.dataset.id, { name: el.value }),
  cycleRole: (_, el) => {
    const p = Store.get('people', el.dataset.id);
    /* Admin is not a role the toggle reaches — it is hidden and never renders a
       role chip — but guard anyway so a stray tap can never demote one into the
       crew and expose it. */
    if (!p || p.role === 'admin') return;
    Store.update('people', p.id, { role: p.role === 'manager' ? 'inspector' : 'manager' });
  },
  toggleActive: (_, el) => {
    const p = Store.get('people', el.dataset.id);
    if (p) Store.update('people', p.id, { active: !p.active });
  },
  addPerson: () => {
    const p = Store.insert('people', { name: 'New person', role: 'inspector', active: true, pinSetOn: '' });
    // Straight into the name field — "New person" is a placeholder, not a name.
    // Same one-shot the workshops screen uses.
    focusNext = 'ppl-' + p.id;
  },
  delPerson: (_, el) => {
    const p = Store.get('people', el.dataset.id);
    if (!p) return;
    if (S.armDelPerson !== p.id) return set({ armDelPerson: p.id });
    Store.remove('people', p.id);
    /* Deleting whoever this phone was signed in as signs it out. me() would
       resolve to null on its own — the id no longer matches anybody — but
       clearing it keeps S honest rather than leaving a dangling id in storage. */
    const patch = { armDelPerson: '' };
    if (S.userId === p.id) patch.userId = '';
    set(patch);
    toast(p.name + ' removed. Past checks keep their name.');
  },

  /* workshops --------------------------------------------------------- */
  renameWorkshop: (_, el) => Store.update('workshops', el.dataset.id, { name: el.value }),
  toggleWorkshop: (_, el) => {
    const w = Store.get('workshops', el.dataset.id);
    if (!w) return;
    Store.update('workshops', w.id, { active: !w.active });
    /* Retiring the shop a half-finished countersign is pointing at would leave
       the picker reading "— pick a workshop —" with an id still behind it.
       Clear it here so what is on screen and what is in S agree. */
    if (w.active && S.assigneeId === w.id) set({ assigneeId: '' });
    const jobs = shopOpenCount(w.id);
    if (w.active && jobs) {
      toast(w.name + ' retired. ' + jobs + (jobs === 1 ? ' open job stays' : ' open jobs stay') + ' with them.');
    }
  },
  addWorkshop: () => {
    const w = Store.insert('workshops', { name: 'New workshop', active: true });
    // Straight into the name field — "New workshop" is a placeholder, not a name.
    focusNext = 'shop-' + w.id;
  }
};

function bump(i, key, dir) {
  editList(items => {
    const step = STEP[items[i].unit];
    items[i][key] = Math.max(0, Math.round((items[i][key] + dir * step) * 10) / 10);
  });
}

/* -------------------------------------------------------------- wiring --- */

function handle(e) {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.a];
  if (!fn) return;
  // Fields act on input, not click — don't fire twice. SELECT belongs here too:
  // a click on it only opens the list, the choice arrives as an input event.
  const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
  if (isField !== (e.type === 'input')) return;
  /* "Tap anything else to cancel" has to be literally true, so the armed reset
     disarms on the way through to whatever was actually tapped — including the
     tab bar and back, which are actions too. Left unrendered: the action about
     to run re-renders anyway. */
  const a = el.dataset.a;
  if (S.armReset && a !== 'resetAll') { S = { ...S, armReset: false }; save(); invalidate(); }
  /* Same rule for the two delete arms. A person's arm is per-row, so tapping
     Delete on a DIFFERENT person must disarm the first one — hence the id
     comparison rather than just the action name. */
  if (S.armDelPerson && !(a === 'delPerson' && el.dataset.id === S.armDelPerson)) {
    S = { ...S, armDelPerson: '' }; save(); invalidate();
  }
  if (S.armDelVan && a !== 'delVan') { S = { ...S, armDelVan: '' }; save(); invalidate(); }
  /* A menu floating over the screen must not survive a tap on the screen. The
     scrim catches most of it, but the tab bar and the back button sit above
     the scrim's own corner of the layout, so close on the way through to
     anything that is not the menu's own three actions. */
  if (S.whoMenu && a !== 'openWho' && a !== 'whoSwitch' && a !== 'signOut' && a !== 'closeWhoMenu') {
    S = { ...S, whoMenu: false }; save(); invalidate();
  }
  fn(e, el);
}

document.addEventListener('click', handle);

/* A .field card is ~46-74px tall but the text line inside it is only ~21px, so a
   thumb aimed at the middle of the card — or at its label — used to focus
   nothing at all. The card looks like one control, so make it behave like one.
   Registered before handle's own listener runs its course but independent of it:
   .field carries no data-a, so handle() never sees these taps. */
document.addEventListener('click', e => {
  const box = e.target.closest('.field');
  if (!box || e.target.matches('input, textarea, select, button, [data-a]')) return;
  const input = box.querySelector('.field-input, .field-select');
  if (input && !input.disabled) input.focus();
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  if (el.dataset.a === 'sbNote') {
    // Typing the note shouldn't rebuild the screen on every keystroke — but it
    // must re-render on the keystroke that arms (or disarms) the confirm button.
    const armed = n => n.trim().length > 2;
    const was = armed(S.sbNote);
    S = { ...S, sbNote: el.value };
    save();
    if (was !== armed(el.value)) invalidate();
    return;
  }
  // Native <input type="date"> is recreated by a full re-render, which yanks
  // focus off the segment being edited — so a per-keystroke render made typing
  // the year (the last segment) impossible: each digit rebuilt the field. Write
  // the value quietly and re-render only when the field flips empty<->filled
  // (that toggles the required styling and the submit button). While the year is
  // being typed the date is still incomplete (value stays '') or already filled,
  // so nothing rebuilds under the caret.
  if (el.dataset.a === 'pickDue') {
    const was = !!S.dueOn;
    S = { ...S, dueOn: el.value };
    save();
    if (was !== !!el.value) invalidate();
    return;
  }
  if (el.dataset.a === 'editMot') {
    const was = !!S.draft.motDue;
    S = { ...S, draft: { ...S.draft, motDue: el.value } };
    save();
    if (was !== !!el.value) invalidate();
    return;
  }
  handle(e);
});

// Enter in a rename field means "done", not "submit".
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input.rename, input.hint-input')) {
    e.preventDefault();
    e.target.blur();
  }
  // Escape shuts the identity menu — the one thing here that floats over a screen.
  if (e.key === 'Escape' && S.help) return set({ help: '' });
  if (e.key === 'Escape' && S.whoMenu) set({ whoMenu: false });
});

/* ---------------------------------------------------------------- boot --- */

/* Only start-up is async: the driver is read once, then every screen reads
   the in-memory db synchronously. */
Store.init({ seed: SEED }).then(() => {
  load();
  Store.subscribe(invalidate);
  history.replaceState({ depth: 0 }, '');
  booted = true;
  document.getElementById('screen')
    .addEventListener('scroll', syncHeaderLift, { passive: true });
  render();
  gcPhotos();
  claimStorage();
});

/* A depot is weeks of checks, defect history and photo blobs, and by default all
   of it sits in BEST-EFFORT storage: the browser may evict it whenever the device
   is short on space, and iOS clears an uninstalled site's data after 7 days idle.
   Evicting a countersigned check is losing a legal record, so ask for the durable
   bucket. Chrome grants it silently once the app is installed or used repeatedly;
   Safari grants it on home-screen install. A refusal is not an error — the app
   works exactly the same, just without the guarantee — so this never blocks boot
   and never interrupts anyone; the ruling is reported quietly under the backup
   buttons, which is where "the only copy off this phone" is already discussed.
   Runs after first paint. */
function claimStorage() {
  if (!navigator.storage || !navigator.storage.persist) return;
  const ask = navigator.storage.persisted
    ? navigator.storage.persisted().then(has => has || navigator.storage.persist())
    : navigator.storage.persist();
  ask
    .then(ok => { STORAGE_DURABLE = !!ok; invalidate(); })
    .catch(() => { STORAGE_DURABLE = false; invalidate(); });
}

/* Photo blobs outlive their check ids only if something goes wrong — a crash
   mid-capture, a restored backup (which carries ids but never blobs). Sweep on
   boot: keep every id still referenced by a saved check or the live draft, drop
   the rest. Runs after render so a slow IndexedDB sweep never delays first paint. */
function gcPhotos() {
  if (!window.Photos || !Photos.gc) return;
  const keep = [];
  Store.all('checks').forEach(c => {
    if (c.photos) Object.keys(c.photos).forEach(k => { if (c.photos[k]) keep.push(c.photos[k]); });
    if (c.signatureId) keep.push(c.signatureId);   // the countersignature blob
  });
  if (S.cap && S.cap.photos) {
    Object.keys(S.cap.photos).forEach(k => { if (S.cap.photos[k]) keep.push(S.cap.photos[k]); });
  }
  Photos.gc(keep);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}
