// Otto brand color tokens — mirror @tsb/app/globals.css. Kept here in code
// (not just tailwind.config.js) so non-Tailwind consumers (e.g. inline styles
// for native components) can use them.

export const colors = {
  bg: '#ffffff',
  bgSoft: '#fafaf9',
  card: '#ffffff',
  cardHover: '#f5f5f4',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textSoft: '#44403c',
  muted: '#78716c',
  accent: '#16a34a',
  accentHover: '#15803d',
  accentSoft: '#f0fdf4',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
} as const;

// Larger than web defaults — older audience, less eye strain, no squinting
// at a phone under booth lighting. These are global multipliers applied via
// `text-class` overrides on body text. We don't override Tailwind defaults
// (so any imported component still works), but every screen-sized text
// element uses these classes.
export const text = {
  // 17px — comfortable body text on Android (browsers use 16px default)
  body: 'text-[17px] leading-7',
  bodyStrong: 'text-[17px] leading-7 font-semibold',
  bodyMuted: 'text-[16px] leading-7 text-otto-muted',
  // 15px — secondary body / metadata. We avoid going smaller.
  small: 'text-[15px] leading-6',
  smallMuted: 'text-[15px] leading-6 text-otto-muted',
  label: 'text-[13px] font-semibold uppercase tracking-[0.18em] text-otto-muted',
  labelAccent: 'text-[13px] font-semibold uppercase tracking-[0.18em] text-otto-accent',
  heading: 'text-[28px] font-semibold tracking-tight text-otto-text leading-tight',
  headingLg: 'text-[32px] font-semibold tracking-tight text-otto-text leading-tight',
  subheading: 'text-[20px] font-semibold text-otto-text',
  button: 'text-[17px] font-semibold',
} as const;
