import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { C } from '../theme';

// Line icons matching the prototype's inline SVGs (viewBox 0 0 24 24, stroked).
const PATHS = {
  check: ['M20 6L9 17l-5-5'],
  chevronRight: ['M9 18l6-6-6-6'],
  chevronDown: ['M6 9l6 6 6-6'],
  x: ['M18 6L6 18M6 6l12 12'],
  search: ['M21 21l-4.3-4.3'],       // + circle
  bolt: ['M13 2L3 14h7l-1 8 10-12h-7z'],
  shield: ['M12 3l7 3v5c0 4.2-2.8 7.4-7 8.5-4.2-1.1-7-4.3-7-8.5V6z'],
  backspace: ['M20 5H9l-6 7 6 7h11a1 1 0 001-1V6a1 1 0 00-1-1z', 'M15 9l-4 6M11 9l4 6'],
  user: ['M5.5 20a6.5 6.5 0 0113 0'], // + circle head
  camera: ['M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z'], // + circle lens
  alert: ['M10.3 3.9L1.9 18a2 2 0 001.7 3h16.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', 'M12 9v4M12 17h.01'],
  info: ['M12 8v4', 'M12 16h.01'],   // + circle
  pen: ['M3 17.5S6 11 12 11s9 6.5 9 6.5', 'M16.5 4.5a2.1 2.1 0 013 3L9 18l-4 1 1-4z'],
  refresh: ['M3 7v6h6', 'M3.5 13a9 9 0 106-8.5'],
  reset: ['M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  truck: ['M2 7.5A1.5 1.5 0 013.5 6H14v10H3.5A1.5 1.5 0 012 14.5z', 'M14 9h3.6a2 2 0 011.7 1l2.2 3.4a2 2 0 01.3 1.1V16H14z'],
  speed: ['M3 14h4l1.5 3h7L17 14h4', 'M4.4 5.6A2 2 0 016.3 4.2h11.4a2 2 0 011.9 1.4L21 14v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z'],
  clipboard: ['M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z', 'M8 6H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2', 'M9 13.5l2 2 4-4'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  plus: ['M12 5v14M5 12h14'],
  clipboardCheck: ['M9 11l3 3L20 6', 'M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9'],
  download: ['M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  listCheck: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4 6l.9.9L6.6 5.2', 'M4 12l.9.9L6.6 11.2', 'M4 18l.9.9L6.6 17.2'],
  users: ['M16 20v-1.8a3.4 3.4 0 00-3.4-3.4H6.4A3.4 3.4 0 003 18.2V20', 'M21 20v-1.8a3.4 3.4 0 00-2.6-3.3', 'M15.6 4.4a3.4 3.4 0 010 6.5'], // + circle head
  help: ['M9.6 9.2a2.4 2.4 0 114 1.8c-.8.6-1.6 1-1.6 2', 'M12 16.6v.1'], // + circle
  gear: ['M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'], // + circle
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14'],
  flip: ['M20.5 12a8.5 8.5 0 01-13.9 6.6', 'M3.5 12a8.5 8.5 0 0113.9-6.6', 'M17.4 1.9v3.5h-3.5', 'M6.6 22.1v-3.5h3.5'],
  lock: ['M8 10V7.5a4 4 0 018 0V10', 'M5.5 10h13a1 1 0 011 1v8a1 1 0 01-1 1h-13a1 1 0 01-1-1v-8a1 1 0 011-1z'],
  upload: ['M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4', 'M7 8l5-5 5 5', 'M12 3v12'],
  arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  person: ['M19 20v-1.8a4 4 0 00-4-4H9a4 4 0 00-4 4V20'], // + circle head
  offline: ['M5 12.5a7 7 0 0113.5-2.5', 'M4 8l1 4 4-1', 'M9 18h9a3 3 0 000-6 4.5 4.5 0 00-8.6-1.4'],
  grid: ['M4 4h16v16H4z', 'M4 10h16', 'M4 15h16', 'M10 4v16'],
  file: ['M6 2h8l5 5v14a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z', 'M14 2v5h5'],
  dots: [],
  dice: [],
};

// Icons that also need circles/rects drawn.
const EXTRAS = {
  search: (p) => <Circle cx="11" cy="11" r="7" {...p} />,
  user: (p) => <Circle cx="12" cy="8" r="3.4" {...p} />,
  camera: (p) => <Circle cx="12" cy="13" r="4" {...p} />,
  info: (p) => <Circle cx="12" cy="12" r="9" {...p} />,
  help: (p) => <Circle cx="12" cy="12" r="9" {...p} />,
  gear: (p) => <Circle cx="12" cy="12" r="3" {...p} />,
  users: (p) => <Circle cx="9.5" cy="7.6" r="3.4" {...p} />,
  dots: (p) => {
    const dot = { fill: p.stroke, stroke: 'none' };
    return (
      <>
        <Circle cx="5" cy="12" r="1.8" {...dot} />
        <Circle cx="12" cy="12" r="1.8" {...dot} />
        <Circle cx="19" cy="12" r="1.8" {...dot} />
      </>
    );
  },
  dice: (p) => {
    const dot = { fill: p.stroke, stroke: 'none' };
    return (
      <>
        <Rect x="3" y="3" width="18" height="18" rx="4" {...p} />
        <Circle cx="8" cy="8" r="1.4" {...dot} />
        <Circle cx="16" cy="8" r="1.4" {...dot} />
        <Circle cx="12" cy="12" r="1.4" {...dot} />
        <Circle cx="8" cy="16" r="1.4" {...dot} />
        <Circle cx="16" cy="16" r="1.4" {...dot} />
      </>
    );
  },
};

export default function Icon({ name, size = 20, color = C.ink, width = 1.8, fill = 'none' }) {
  const paths = PATHS[name] || [];
  const stroke = { stroke: color, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  const Extra = EXTRAS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      {paths.map((d, i) => <Path key={i} d={d} {...stroke} />)}
      {Extra ? Extra(stroke) : null}
    </Svg>
  );
}
