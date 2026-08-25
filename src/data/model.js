// Data model ported from SpotCheckPhone.dc.html (deterministic seed data).

export const PEOPLE = {
  'Tien Nguyen': { role: 'Manager', line: 'can approve', ini: 'TN', waiting: 2, month: 38, week: 9, defects: 4, since: 'March 2024' },
  'Michael Pak': { role: 'Manager', line: 'can approve', ini: 'MP', waiting: 5, month: 22, week: 5, defects: 2, since: 'January 2025' },
  'Phuog Lam': { role: 'Inspector', line: 'checks vehicles', ini: 'PL', waiting: 0, month: 31, week: 7, defects: 3, since: 'September 2023' },
  'Ben Wang': { role: 'Inspector', line: 'checks vehicles', ini: 'BW', waiting: 0, month: 26, week: 6, defects: 1, since: 'June 2024' },
  'System Admin': { role: 'Admin', line: 'sets up the depot', ini: 'SA', waiting: 0, month: 0, week: 0, defects: 0, since: '—' },
};

export const CHECKLIST = {
  version: 4,
  sections: [
    { id: 'eng', name: 'Engine', items: [
      { id: 'eng1', text: 'Engine Oil / Level' },
      { id: 'eng2', text: 'Engine Coolant' },
      { id: 'eng3', text: 'Steering & Brake Fluid' },
      { id: 'eng4', text: 'Leaks, Seals & Hoses' } ] },
    { id: 'body', name: 'Vehicle Body', items: [
      { id: 'body1', text: 'Panels and Doors' },
      { id: 'body2', text: 'Mud Flaps' },
      { id: 'body3', text: 'Mirrors' },
      { id: 'body4', text: 'Registration Plates / Signs' },
      { id: 'body5', text: 'Tray' },
      { id: 'body6', text: 'Fixtures and Fittings' } ] },
    { id: 'elec', name: 'Electrical', items: [
      { id: 'elec1', text: 'Headlights (High / Low)' },
      { id: 'elec2', text: 'Park Lights' },
      { id: 'elec3', text: 'Indicators' },
      { id: 'elec4', text: 'Clearance Lights' },
      { id: 'elec5', text: 'Taillights / Plate Lights' },
      { id: 'elec6', text: 'Brake Lights', added: true },
      { id: 'elec7', text: 'Hazard Lights', added: true },
      { id: 'elec8', text: 'Windscreen Wipers' } ] },
    { id: 'wheel', name: 'Wheels & Tyres', items: [
      { id: 'wheel1', text: 'Rims' },
      { id: 'wheel2', text: 'Tyres' },
      { id: 'wheel3', text: 'Spare Wheel', retire: true } ] },
    { id: 'safe', name: 'Safety Equipment', items: [
      { id: 'safe1', text: 'Warning Triangles' },
      { id: 'safe2', text: 'Fire Extinguishers' },
      { id: 'safe3', text: 'Spill Kit' },
      { id: 'safe4', text: 'Fluoro Vest, Gloves, Hard Hat' },
      { id: 'safe5', text: 'First Aid Kit' } ] },
    { id: 'reg', name: 'Registration', items: [
      { id: 'reg1', text: 'Registration documents current and available' } ] },
  ],
};

export const CORRECT_PIN = '1234';
export const IDLE_MS = 120000;
export const APP_BUILD = 'v30';

// Roles inherit downward: a Manager can do everything an Inspector can, plus its own.
// 'Admin' is the stored value for a Manager granted system-admin access; it reads "Manager +".
export const ROLE_ORDER = ['Inspector', 'Manager', 'Admin'];

// Capabilities per role. `seed: true` marks one that ships with the app — those can be
// switched off but not deleted, so a depot can't lose a capability the code still checks for.
export function seedCapGroups() {
  return [
    { role: 'Inspector', caps: [
      { name: 'Run full inspection', desc: 'Draw a vehicle and record a full inspection.', seed: true },
      { name: 'Record readings', desc: 'Enter measured values and capture the walk-around photos.', seed: true },
      { name: 'Flag failed items', desc: 'Mark an item failed with a note during the full inspection.', seed: true } ] },
    { role: 'Manager', caps: [
      { name: 'Approve & check', desc: 'Approve a submitted full inspection, moving it into Approvals.', seed: true },
      { name: 'Review / send back', desc: 'Return a check to the inspector with a reason.', seed: true },
      { name: 'New / edit defects', desc: 'Raise a defect, assign a workshop, and set a due date.', seed: true } ] },
    { role: 'Admin', caps: [
      { name: 'Manage people', desc: 'Add, suspend or delete crew and set their roles.', seed: true },
      { name: 'Backup & restore', desc: 'Save a backup, or wipe and replace the whole depot.', seed: true },
      { name: 'Edit checklist & rules', desc: 'Change the checklist and the draw rules, and publish.', seed: true } ] },
  ];
}

export function initials(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0] || '')[0] || '').toUpperCase() + ((parts[1] || '')[0] || '').toUpperCase();
}

export function seedPeople() {
  return [
    { name: 'Tien Nguyen', role: 'Manager', ini: 'TN', suspended: false, since: 'March 2024' },
    { name: 'Michael Pak', role: 'Manager', ini: 'MP', suspended: false, since: 'January 2025' },
    { name: 'Phuog Lam', role: 'Inspector', ini: 'PL', suspended: false, since: 'September 2023' },
    { name: 'Ben Wang', role: 'Inspector', ini: 'BW', suspended: false, since: 'June 2024' },
    { name: 'Aisha Khan', role: 'Inspector', ini: 'AK', suspended: false, since: 'November 2024' },
    { name: 'Rob Ellis', role: 'Inspector', ini: 'RE', suspended: true, since: 'February 2023' },
  ];
}

// Flatten checklist to the "clModel" shape used during a check (all live items).
export function checklistModel() {
  return CHECKLIST.sections.map((s) => ({
    id: s.id,
    name: s.name,
    items: s.items.map((it) => ({ ...it, section: s.name, sectionId: s.id })),
  }));
}

export function genVans() {
  const models = [
    { name: 'Ford Transit', fuel: 'Diesel', vin: 'WF0' },
    { name: 'Ford Transit Custom', fuel: 'Diesel', vin: 'WF0' },
    { name: 'MB Sprinter', fuel: 'Diesel', vin: 'WDB' },
    { name: 'MB Vito', fuel: 'Diesel', vin: 'WDF' },
    { name: 'VW Crafter', fuel: 'Diesel', vin: 'WV1' },
    { name: 'VW Transporter', fuel: 'Diesel', vin: 'WV2' },
    { name: 'Renault Master', fuel: 'Diesel', vin: 'VF1' },
    { name: 'Renault Trafic', fuel: 'Diesel', vin: 'VF1' },
    { name: 'Vauxhall Vivaro', fuel: 'Diesel', vin: 'W0V' },
    { name: 'Peugeot Boxer', fuel: 'Diesel', vin: 'VF3' },
    { name: 'Fiat Ducato', fuel: 'Diesel', vin: 'ZFA' },
    { name: 'Ford E-Transit', fuel: 'Electric', vin: 'WF0' },
    { name: 'MB eVito', fuel: 'Electric', vin: 'WDF' },
  ];
  const ages = [['18', 2018], ['68', 2018], ['19', 2019], ['69', 2019], ['20', 2020], ['70', 2020], ['21', 2021], ['71', 2021], ['22', 2022], ['72', 2022], ['23', 2023], ['73', 2023]];
  const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const jobsPool = [
    'Nearside brake light out', 'OSR tyre tread below 1.6mm', 'Windscreen chip in swept area', 'Nearside wing mirror glass cracked',
    'Coolant weep at top hose', 'Tail-lift slow to raise', 'Handbrake travel excessive', 'Offside indicator intermittent',
    'Load area floor trim lifting', 'Reversing bleeper inoperative', 'Wiper blade split (driver side)', 'Fuel cap seal perished',
    'AdBlue warning on dash', 'Nearside sliding door catch worn', 'Front number plate lamp out',
  ];
  const inspectors = ['Tien Nguyen', 'Michael Pak', 'Phuog Lam', 'Ben Wang'];
  const drivers = ['James Whelan', 'Priya Shah', 'Darren Cole', 'Elena Petrov', 'Marcus Boateng', 'Hannah Blake', 'Sean Riley', 'Nina Kowalski', 'Owen Pearce', 'Leah Mensah', 'Tomasz Wójcik', 'Aisha Rahman', 'Gary Fletcher', 'Sofia Marín', 'Unassigned'];
  const area = ['LA', 'LB', 'LC', 'LD', 'LF', 'LG', 'LJ', 'LK', 'LL', 'LM', 'LN', 'LP', 'LR', 'LT', 'LV'];
  const A = 'ABCDEFGHJKLMNOPRSTUVWXYZ';
  const L = (c) => A[((c % A.length) + A.length) % A.length];
  const NOW_Y = 2026, NOW_M = 7;
  const dstr = (d, m, y) => d + ' ' + monthName[((m % 12) + 12) % 12] + ' ' + y;
  const out = [];
  const N = 46;
  const REGOS = ['FTW73B', 'FTG29S', 'ENS95D', 'CN40ZM', 'DLH92G', 'ECI16A', 'FFO41K', 'YNX74Q', 'YNX74R', 'EVU54K', 'FHO67D', 'YNX86B', 'YNX86C', 'FSK38B', 'YNX93E', 'FJR28B', 'FJS78U', 'TN3636'];
  for (let i = 0; i < N; i++) {
    const ag = ages[(i * 5) % ages.length];
    const plate = REGOS[i] || (area[(i * 3) % area.length] + ag[0] + ' ' + L(i * 7 + 3) + L(i * 11 + 5) + L(i * 4 + 9));
    const m = models[(i * 3 + 1) % models.length];
    const model = m.name;
    const year = ag[1];
    const ageYears = Math.max(1, NOW_Y - year);
    const bay = ['A', 'B', 'C', 'D', 'E'][i % 5] + (1 + (i % 8));
    const last = (i * 5 + (i % 3)) % 68;
    const blocked = (i % 12 === 0);
    const expired = (i % 21 === 0);
    const blockDoc = i % 2 ? 'Roadworthy' : 'Insurance';
    const dueDays = expired ? -(1 + (i % 11)) : (4 + (i % 18));
    const _pl = (n) => (Math.abs(n) === 1 ? ' day' : ' days');
    const blockReason = blocked ? (expired ? blockDoc + ' expired ' + Math.abs(dueDays) + _pl(dueDays) + ' ago' : blockDoc + ' expires in ' + dueDays + _pl(dueDays)) : '';
    const jobs = [];
    if (i % 5 === 0) jobs.push(jobsPool[(i * 2) % jobsPool.length]);
    if (i % 17 === 0) jobs.push(jobsPool[(i * 2 + 5) % jobsPool.length]);
    const odo = m.fuel === 'Electric' ? (6000 + ageYears * 9000 + (i * 811) % 7000) : (ageYears * (19000 + (i % 6) * 1400) + (i * 613) % 9000);
    const motM = (NOW_M + 1 + (i % 6)) % 12, motY = NOW_Y + (NOW_M + 1 + (i % 6) >= 12 ? 1 : 0);
    const insM = (NOW_M + 2 + (i % 5)) % 12, insY = NOW_Y + (NOW_M + 2 + (i % 5) >= 12 ? 1 : 0);
    const docs = [
      { name: 'Roadworthy', date: (blocked && blockDoc === 'Roadworthy' && expired) ? dstr(20 + (i % 8), NOW_M, NOW_Y) : dstr(1 + (i % 27), motM, motY), soon: blocked && blockDoc === 'Roadworthy', dueDays: (blocked && blockDoc === 'Roadworthy') ? dueDays : null, expired: expired && blockDoc === 'Roadworthy' },
      { name: 'Insurance', date: (blocked && blockDoc === 'Insurance' && expired) ? dstr(18 + (i % 9), NOW_M, NOW_Y) : dstr(1 + ((i + 6) % 27), insM, insY), soon: blocked && blockDoc === 'Insurance', dueDays: (blocked && blockDoc === 'Insurance') ? dueDays : null, expired: expired && blockDoc === 'Insurance' },
      { name: (i % 3 === 0 ? 'Safety inspection' : (i % 3 === 1 ? 'Service' : 'Registration')), date: dstr(1 + ((i + 3) % 27), (NOW_M + 5 + (i % 4)) % 12, NOW_Y + 1), soon: false, dueDays: null, expired: false },
    ];
    const hist = [];
    const hn = 2 + (i % 4);
    for (let h = 0; h < hn; h++) {
      const dAgo = last + h * (11 + (i % 9));
      const dt = new Date(2026, NOW_M, 14 - (dAgo % 28));
      hist.push({ date: dstr(dt.getDate(), (NOW_M - Math.floor(dAgo / 30) + 12) % 12, 2026), by: inspectors[(i + h) % inspectors.length], result: (jobs.length && h === 0) ? 'Fault found' : 'Passed', photos: 5 + ((i + h) % 7) });
    }
    const driver = drivers[(i * 3) % drivers.length];
    const driverSince = driver === 'Unassigned' ? '' : dstr(1 + (i % 27), (NOW_M - 2 - (i % 5) + 12) % 12, 2026);
    const inservice = monthName[(i * 2) % 12] + ' ' + year;
    const vin = m.vin + 'ZZZ' + L(i).toString() + (year % 100) + (100000 + (i * 3607) % 899999);
    const log = hist.map((h) => ({ when: h.date, who: h.by, what: h.result === 'Fault found' ? 'Full inspection logged — fault found' : 'Full inspection logged — passed', kind: h.result === 'Fault found' ? 'fault' : 'check' }));
    log.unshift({ when: hist[0] ? hist[0].date : dstr(2, NOW_M, 2026), who: hist[0] ? hist[0].by : inspectors[0], what: 'Odometer reading ' + odo.toLocaleString() + ' km', kind: 'odo' });
    jobs.forEach((j, ji) => log.unshift({ when: hist[0] ? hist[0].date : dstr(2, NOW_M, 2026), who: inspectors[(i + ji) % inspectors.length], what: 'Defect raised — ' + j, kind: 'fault' }));
    if (driver !== 'Unassigned') log.push({ when: driverSince, who: 'Depot admin', what: 'Driver assigned — ' + driver, kind: 'key' });
    out.push({ plate, model, bay, last, blocked, blockReason, expired, jobs, docs, history: hist, driver, driverSince, odo, year, fuel: m.fuel, vin, inservice, log });
  }
  return out;
}

export function seedQueue(fleet) {
  const f = fleet;
  const withJob = f.find((v) => v.jobs && v.jobs.length) || f[3];
  const clean = f.find((v) => (!v.jobs || !v.jobs.length) && !v.blocked) || f[1];
  return [
    { id: 'q1', plate: withJob.plate, by: 'Ben Wang', date: '20 Aug 2026', result: 'Fault found', defects: withJob.jobs.length || 1, note: (withJob.jobs && withJob.jobs[0]) || 'Nearside brake light out' },
    { id: 'q2', plate: clean.plate, by: 'Phuog Lam', date: '20 Aug 2026', result: 'Passed', defects: 0, note: '' },
  ];
}

export function seedApproved(fleet) {
  const f = fleet;
  const p = (i) => (f[i] || f[0]).plate;
  return [
    { id: 'a1', plate: p(5), by: 'Phuog Lam', date: '19 Aug 2026', result: 'Passed', defects: 0, signedBy: 'Tien Nguyen', week: true },
    { id: 'a2', plate: p(8), by: 'Phuog Lam', date: '18 Aug 2026', result: 'Passed', defects: 0, signedBy: 'Tien Nguyen', week: true },
    { id: 'a3', plate: p(11), by: 'Ben Wang', date: '18 Aug 2026', result: 'Fault found', defects: 1, signedBy: 'Michael Pak', week: true },
    { id: 'a4', plate: p(2), by: 'Ben Wang', date: '15 Aug 2026', result: 'Passed', defects: 0, signedBy: 'Tien Nguyen', week: false },
    { id: 'a5', plate: p(14), by: 'Phuog Lam', date: '11 Aug 2026', result: 'Fault found', defects: 2, signedBy: 'Michael Pak', week: false },
  ];
}

// ---------------------------------------------------------------------------
// Help topics. The prototype kept these notes on the working screens; they were
// pulled out so a screen mid-job stays clear. A paragraph is either a string or
// { text, tone: 'warn' } for the amber caveats.
//
// The Backup and Offline topics are rewritten from the prototype: it was a web
// build that saved a .json to downloads and asked you to install a PWA. This is
// a native app — the backup is a second slot in phone storage and there is no
// home-screen install — so the original copy would have been wrong here.
export const HELP = [
  {
    label: 'Doing the work',
    topics: [
      {
        id: 'draw',
        icon: 'truck',
        title: 'How the vehicle is picked',
        sub: 'The draw, the exclusion window, re-rolls',
        body: [
          'The app draws the vehicle, not you. A full inspection is only worth anything if nobody chose where it landed — pick from a list and the same three easy vehicles get walked every week while the awkward one at the back of the yard never does.',
          'Only active vehicles go in. One that was checked in the last few days is held out so it can’t come up twice in a week, and any vehicle left too long is forced to the front until somebody walks it. Both of those numbers are yours to set, in Depot configuration.',
          'You can re-roll a draw a set number of times, and you can still check a named vehicle when there is a reason to — a complaint, a return from the workshop. The draw is the default, not a lock.',
        ],
      },
      {
        id: 'people',
        icon: 'users',
        title: 'Suspending and deleting people',
        sub: 'What happens to the checks they signed',
        body: [
          'Suspending someone keeps every check they signed. They just can’t sign in — and their open defects stay on the depot’s list, not theirs.',
          'Deleting is for someone added by mistake. It removes them from the depot but never from a record they signed: a check copies the name onto itself when it is submitted, so past checks read the same afterwards.',
          'Suspend is the one to use for somebody who has left.',
        ],
      },
      {
        id: 'roles',
        icon: 'person',
        title: 'Two roles, one fleet',
        sub: 'Who checks, who approves',
        body: [
          'One depot, two roles: inspectors check vehicles, managers approve. Everyone here sees the same fleet.',
          'An approval is a manager’s claim that they reviewed the full inspection — the photos, the readings, the defect notes — and stand behind it. An inspector can’t countersign their own check; the signing manager has to be someone else.',
        ],
      },
    ],
  },
  {
    label: 'Keeping the depot safe',
    topics: [
      {
        id: 'backup',
        icon: 'download',
        title: 'Backup and storage',
        sub: 'Everything lives on this phone only',
        body: [
          'Everything you enter is kept on this phone only — there is no account and no server. Saving a backup writes the whole depot into a second slot in this phone’s storage, separate from the live depot, so a bad restore or a wrong reset has something to come back from.',
          'The backup carries every vehicle, person, check and defect, plus your checklist. It does not carry the photos — the record still says a shot was taken, but those slots come back empty.',
          {
            text: 'A backup in phone storage is not a copy held anywhere else: losing or wiping the phone loses both the depot and its backup. Until this depot syncs to a server, treat the phone as the only copy.',
            tone: 'warn',
          },
        ],
      },
      {
        id: 'offline',
        icon: 'offline',
        title: 'Working offline',
        sub: 'No signal needed anywhere in the yard',
        body: [
          'The app runs entirely on the phone. A full inspection in a basement car park, or the dead spot at the back of the yard, works exactly the same as one at the office door — nothing is sent anywhere and nothing waits on a signal.',
          'Photos are the one thing to watch. A captured frame is written to the phone’s working storage, which the system can clear when the device runs short on space, so upload or hand over a check rather than leaving it sitting for weeks.',
        ],
      },
    ],
  },
];
