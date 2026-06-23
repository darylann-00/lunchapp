import React from 'react';

// Hand-drawn "sticker" UI icons that match the custom food PNGs in
// /public/icons/food: one bold navy outline + flat luncharoo-palette fills.
// Authored inline (one reviewable file, no asset sprawl) and rendered at
// 12–48px, so each shape is kept deliberately simple and bold.

const N = '#134e9e'; // navy outline / shadow
const BL = '#00bcf2'; // blue
const CO = '#f36c57'; // coral
const YE = '#f9b922'; // yellow
const PE = '#f9a65d'; // peach
const GR = '#7ac74f'; // green
const WH = '#ffffff';

const ICONS: Record<string, React.ReactNode> = {
  // Grocery basket — also used for "ingredients" headers
  basket: (
    <>
      <defs>
        <clipPath id="uiBasketClip">
          <path d="M11,20 L14,37 Q15,41 24,41 Q33,41 34,37 L37,20 Z" />
        </clipPath>
      </defs>
      <path d="M14,18 Q24,7 34,18" fill="none" />
      <path d="M11,20 L14,37 Q15,41 24,41 Q33,41 34,37 L37,20 Z" fill={YE} />
      <g clipPath="url(#uiBasketClip)" strokeWidth={2.4}>
        <path d="M17,19 L9,41" />
        <path d="M25,19 L18,42" />
        <path d="M33,19 L27,42" />
        <path d="M19,42 L33,19" />
        <path d="M11,42 L25,19" />
      </g>
      <rect x="9" y="16" width="30" height="6.5" rx="3.2" fill={CO} />
    </>
  ),

  // Browse — fork + knife
  utensils: (
    <>
      <path d="M16,9 L16,17" />
      <path d="M12,9 L12,16" />
      <path d="M20,9 L20,16" />
      <path d="M12,16 Q12,20 16,20 L16,40 L16,20 Q20,20 20,16" fill={WH} />
      <path d="M32,9 Q28,9 28,17 Q28,21 32,21 Z" fill={WH} />
      <path d="M32,9 L32,40" />
    </>
  ),

  // Kid face (profile / kid badge)
  kid: (
    <>
      <circle cx="24" cy="25" r="14" fill={PE} />
      <path d="M18,12 L17,15" />
      <path d="M24,11 L24,14" />
      <path d="M30,12 L31,15" />
      <circle cx="19" cy="24" r="1.9" fill={N} stroke="none" />
      <circle cx="29" cy="24" r="1.9" fill={N} stroke="none" />
      <path d="M19,30 Q24,34 29,30" fill="none" />
    </>
  ),

  // Parent face (chat avatar)
  parent: (
    <>
      <path d="M11,33 Q9,8 24,8 Q39,8 37,33 L37,21 Q37,15 24,15 Q11,15 11,21 Z" fill="#7a4e2e" />
      <circle cx="24" cy="26" r="12" fill={PE} />
      <circle cx="20" cy="25" r="1.8" fill={N} stroke="none" />
      <circle cx="28" cy="25" r="1.8" fill={N} stroke="none" />
      <path d="M20,30 Q24,33 28,30" fill="none" />
    </>
  ),

  // Robot (bot avatar)
  robot: (
    <>
      <path d="M24,16 L24,10" />
      <circle cx="24" cy="8" r="2.5" fill={CO} />
      <rect x="12" y="16" width="24" height="20" rx="6" fill={BL} />
      <circle cx="19" cy="25" r="2.6" fill={WH} />
      <circle cx="29" cy="25" r="2.6" fill={WH} />
      <circle cx="19" cy="25" r="1" fill={N} stroke="none" />
      <circle cx="29" cy="25" r="1" fill={N} stroke="none" />
      <path d="M19,31 L29,31" />
    </>
  ),

  // Rainbow (announcement strip) — colored bands, no navy outline
  rainbow: (
    <>
      <path d="M8,38 A16,16 0 0 1 40,38" fill="none" stroke={CO} strokeWidth={4} />
      <path d="M13,38 A11,11 0 0 1 35,38" fill="none" stroke={YE} strokeWidth={4} />
      <path d="M18,38 A6,6 0 0 1 30,38" fill="none" stroke={BL} strokeWidth={4} />
    </>
  ),

  // Wizard wand — star floats free above the tip, no stars touch the handle
  wand: (
    <>
      <path d="M28,20 L32,23 L15,41 L11,38 Z" fill={BL} />
      <path d="M37,4 L38.76,8.57 L43.66,8.84 L39.85,11.93 L41.11,16.66 L37,14 L32.89,16.66 L34.15,11.93 L30.34,8.84 L35.24,8.57 Z" fill={YE} />
      <path d="M15,10 L16,13 L19,14 L16,15 L15,18 L14,15 L11,14 L14,13 Z" fill={CO} strokeWidth={2} />
      <path d="M42,24 L42.8,26.2 L45,27 L42.8,27.8 L42,30 L41.2,27.8 L39,27 L41.2,26.2 Z" fill={BL} strokeWidth={1.8} />
    </>
  ),

  // Sparkle / generate
  sparkle: (
    <>
      <path d="M24,7 L27,21 L41,24 L27,27 L24,41 L21,27 L7,24 L21,21 Z" fill={YE} />
      <path d="M38,9 L39,12 L42,13 L39,14 L38,17 L37,14 L34,13 L37,12 Z" fill={CO} strokeWidth={2} />
    </>
  ),

  // Edit pencil
  edit: (
    <>
      <path d="M14,40 L15,34 L31,18 L37,24 L21,40 Z" fill={YE} />
      <path d="M31,18 L35,14 Q37,12 39,14 L41,16 Q43,18 41,20 L37,24 Z" fill={CO} />
      <path d="M14,40 L15,34 L20,39 Z" fill={N} stroke="none" />
      <path d="M32,17 L38,23" strokeWidth={2.4} />
    </>
  ),

  // Regenerate / refresh (navy strokes — reads on coral buttons)
  refresh: (
    <>
      <path d="M13,24 A11,11 0 0 1 33,17" fill="none" />
      <path d="M34,9 L34.5,18 L26,16 Z" fill={N} stroke="none" />
      <path d="M35,24 A11,11 0 0 1 15,31" fill="none" />
      <path d="M14,39 L13.5,30 L22,32 Z" fill={N} stroke="none" />
    </>
  ),

  // Save (floppy disk)
  save: (
    <>
      <path d="M11,14 Q11,11 14,11 L31,11 L37,17 L37,34 Q37,37 34,37 L14,37 Q11,37 11,34 Z" fill={BL} />
      <rect x="16" y="24" width="16" height="13" rx="1.5" fill={WH} />
      <rect x="18" y="11" width="11" height="8" rx="1" fill={WH} />
      <rect x="24" y="12" width="3" height="6" rx="0.5" fill={BL} stroke="none" />
    </>
  ),

  // Check (approve / success)
  check: (
    <>
      <circle cx="24" cy="24" r="15" fill={GR} />
      <path d="M16,24 L22,30 L33,18" fill="none" stroke={WH} strokeWidth={4.5} />
    </>
  ),

  // Warning
  warning: (
    <>
      <path d="M24,8 L41,38 L7,38 Z" fill={YE} strokeLinejoin="round" />
      <path d="M24,18 L24,28" strokeWidth={3.5} />
      <circle cx="24" cy="33" r="1.7" fill={N} stroke="none" />
    </>
  ),

  // Packaged — a sealed snack bag
  box: (
    <>
      <path d="M14,13 L16,9 L18,13 L20,9 L22,13 L24,9 L26,13 L28,9 L30,13 L32,9 L34,13 Z" fill={YE} />
      <path d="M15,13 L33,13 L33,37 Q33,40 30,40 L18,40 Q15,40 15,37 Z" fill={CO} />
      <rect x="15" y="22" width="18" height="8" fill={WH} stroke="none" />
      <rect x="15" y="22" width="18" height="8" fill="none" />
      <circle cx="24" cy="26" r="2" fill={CO} stroke="none" />
    </>
  ),

  // Condiments — a ketchup squeeze bottle
  jar: (
    <>
      <path d="M18,18 Q18,13 24,13 Q30,13 30,18 L30,36 Q30,40 26,40 L22,40 Q18,40 18,36 Z" fill={CO} />
      <path d="M20,13 L20,8 Q20,7 21,7 L27,7 Q28,7 28,8 L28,13 Z" fill={WH} />
      <rect x="19.5" y="24" width="9" height="9" rx="1.5" fill={WH} stroke="none" />
      <rect x="19.5" y="24" width="9" height="9" rx="1.5" fill="none" />
      <circle cx="24" cy="28.5" r="2" fill={CO} stroke="none" />
    </>
  ),

  // Calendar
  calendar: (
    <>
      <rect x="9" y="13" width="30" height="27" rx="4" fill={WH} />
      <path d="M9,19 Q9,13 15,13 L33,13 Q39,13 39,19 L39,21 L9,21 Z" fill={CO} stroke="none" />
      <rect x="9" y="13" width="30" height="27" rx="4" fill="none" />
      <path d="M16,9 L16,16" strokeWidth={3} />
      <path d="M32,9 L32,16" strokeWidth={3} />
      <circle cx="17" cy="28" r="1.6" fill={N} stroke="none" />
      <circle cx="24" cy="28" r="1.6" fill={N} stroke="none" />
      <circle cx="31" cy="28" r="1.6" fill={N} stroke="none" />
      <circle cx="17" cy="34" r="1.6" fill={N} stroke="none" />
      <circle cx="24" cy="34" r="1.6" fill={N} stroke="none" />
    </>
  ),

  // Lock (sign-in)
  lock: (
    <>
      <path d="M17,22 L17,17 Q17,9 24,9 Q31,9 31,17 L31,22" fill="none" />
      <rect x="12" y="22" width="24" height="17" rx="4" fill={YE} />
      <circle cx="24" cy="28" r="2.6" fill={N} stroke="none" />
      <path d="M24,28 L24,34" strokeWidth={2.6} />
    </>
  ),

  // Mail envelope (magic link)
  mail: (
    <>
      <rect x="8" y="13" width="32" height="22" rx="4" fill={BL} />
      <path d="M9,15 L24,26 L39,15" fill="none" strokeWidth={3.4} />
    </>
  ),

  // Microphone (voice)
  mic: (
    <>
      <rect x="18" y="8" width="12" height="20" rx="6" fill={CO} />
      <path d="M13,24 Q13,33 24,33 Q35,33 35,24" fill="none" />
      <path d="M24,33 L24,40" />
      <path d="M18,40 L30,40" />
    </>
  ),

  // Layers (a component that "also fills" multiple slots)
  layers: (
    <>
      <rect x="9" y="14" width="20" height="20" rx="4" fill={YE} />
      <rect x="19" y="20" width="20" height="20" rx="4" fill={BL} />
    </>
  ),

  // Lightbulb (tip)
  bulb: (
    <>
      <path d="M24,7 Q34,7 34,18 Q34,24 28,27 L20,27 Q14,24 14,18 Q14,7 24,7 Z" fill={YE} />
      <rect x="20" y="27" width="8" height="6" rx="1.5" fill={WH} />
      <path d="M21,37 L27,37" strokeWidth={3} />
      <path d="M21,20 Q24,23 27,20" fill="none" strokeWidth={2.4} />
    </>
  ),

  // Lightning bolt (quick / no-cook)
  bolt: (
    <path d="M27,6 L14,27 L22,27 L20,42 L34,20 L25,20 L29,6 Z" fill={YE} strokeLinejoin="round" />
  ),

  // Filled heart (favorite on) — fill follows the button's text color
  // (coral when active, white on a coral button) so it reads on any bg.
  heart: (
    <path d="M24,38 C9,27 11,12 19.5,12 C23,12 24,16 24,16 C24,16 25,12 28.5,12 C37,12 39,27 24,38 Z" fill="currentColor" />
  ),

  // Empty heart (favorite off) — navy outline, transparent interior
  'heart-o': (
    <path d="M24,38 C9,27 11,12 19.5,12 C23,12 24,16 24,16 C24,16 25,12 28.5,12 C37,12 39,27 24,38 Z" fill="none" />
  ),

  // Mr-Yuk — "no thanks" / disliked (green, tongue out)
  yuk: (
    <>
      <circle cx="24" cy="24" r="15" fill={GR} />
      <path d="M15,21 Q18,24 21,21" fill="none" strokeWidth={2.6} />
      <path d="M27,21 Q30,24 33,21" fill="none" strokeWidth={2.6} />
      <path d="M18,31 Q24,28 30,31" fill="none" />
      <path d="M22,32 Q22,38 25,38 Q28,38 27,32 Z" fill={CO} />
    </>
  ),

  // Mr-Yuk outline (not disliked) — neutral, transparent interior
  'yuk-o': (
    <>
      <circle cx="24" cy="24" r="15" fill="none" />
      <path d="M15,21 Q18,24 21,21" fill="none" strokeWidth={2.6} />
      <path d="M27,21 Q30,24 33,21" fill="none" strokeWidth={2.6} />
      <path d="M18,31 Q24,28 30,31" fill="none" />
      <path d="M22,32 Q22,38 25,38 Q28,38 27,32 Z" fill="none" />
    </>
  ),
};

interface UiIconProps {
  name: keyof typeof ICONS | string;
  size?: number;
  className?: string;
  title?: string;
}

const UiIcon = React.memo(({ name, size = 20, className = '', title }: UiIconProps) => {
  const icon = ICONS[name];
  if (!icon) return null;

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
      fill="none"
      stroke={N}
      strokeWidth={3.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title ?? String(name)}
    >
      {icon}
    </svg>
  );
});

UiIcon.displayName = 'UiIcon';

export default UiIcon;
