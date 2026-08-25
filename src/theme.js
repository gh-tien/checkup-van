// Palette + typography ported from SpotCheckPhone.dc.html.
//
// The neutral ramp deviates from the prototype deliberately: the ported greys failed WCAG AA on
// white (muted 3.87, muted3 2.56, faint 1.64) and they carry nearly every subtitle, placeholder and
// chevron in the app. Each has been darkened along its own hue to clear the bar it is actually
// judged against — 4.5:1 for text, 3:1 for UI graphics. See DECISIONS.md (2026-08-24).
export const C = {
  primary: '#1B4D7A',
  primaryDeep: '#14375A',
  ink: '#1B2126',

  danger: '#A03428',
  dangerBg: '#FBEEEC',
  dangerBg2: '#FDF6F5',
  dangerBorder: '#F0D9D5',

  amber: '#8A6116',
  amberBg: '#FBF3E7',

  green: '#397B43',        // 4.53:1 on greenBg (was #3A7D44 = 4.42, marginal)
  greenBg: '#EAF3EC',
  greenBg2: '#EFF6F0',
  greenTint: '#F4FAF5',
  greenBorder: '#BCD9C2',
  greenBorderSoft: '#CFE6D4',

  muted: '#616B73',        // 5.44:1 on card — subtitles, section labels
  muted2: '#58626A',       // 6.23:1 on card — secondary body
  muted3: '#68727A',       // 4.91:1 on card — lightest text tier, placeholders
  faint: '#8B9197',        // 3.05:1 on card — UI graphics only (chevrons, PIN dots)

  border: '#E7EBEE',
  border2: '#EEF1F3',
  border3: '#D3D9DD',
  borderMuted: '#C6D2DC',
  hair: '#F1F2F3',

  card: '#FFFFFF',
  cardSubtle: '#FAFBFC',
  cardAlt: '#FBFBFA',
  appBg: '#FFFFFF',
  inputBg: '#F6F7F8',

  chipBlue: '#E9F0F6',
  tintBlue: '#F6F9FC',
  tintBlueBorder: '#E3EBF2',

  // One not-ready look for every button in the app, per ResetModal's pattern: the control stays
  // pressable and explains why it cannot proceed. 5.56:1, so the reason is legible.
  disabledBg: '#F1F2F3',
  disabledTxt: '#58626A',

  slate: '#5B6670',
  draw: '#F4C430',
  drawBorder: '#E0B420',
};

// Font family keys registered via @expo-google-fonts in App.js.
export const F = {
  sans: 'Fustat_400Regular',
  sansMed: 'Fustat_500Medium',
  sansSemi: 'Fustat_600SemiBold',
  sansBold: 'Fustat_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMed: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
  monoBold: 'IBMPlexMono_700Bold',
};

// Minimum heights for anything tappable. `sm` is the WCAG/HIG floor and the default for chips,
// segmented controls and inline actions; `md` is for controls used repeatedly in the field
// (Pass/Fail, Submit); `lg` is for a full-width commit at the end of a flow.
export const CTRL = { sm: 44, md: 48, lg: 56 };

// Shared soft card shadow (0 1px 2px rgba(27,33,38,.04))
export const cardShadow = {
  shadowColor: '#1B2126',
  shadowOpacity: 0.05,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};
