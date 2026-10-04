/**
 * The workbench's small drawings, in place of the ✓ ✕ ⏰ ⚠ ‹ › that were typed as text: an
 * emoji renders in the phone's own colours and size, and a screen reader reads it out as a word
 * nobody chose. Each one here is decoration beside a visible word or an aria-label, so all of
 * them are aria-hidden. One 24-grid, one stroke, the colour of the text around it.
 */

type IconProps = { className?: string };

function Svg({ className = "size-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const XIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const ClockIcon = (p: IconProps) => <Svg {...p}><path d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 8v4.3l2.8 1.7" /></Svg>;
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 4 21 19.5H3zM12 10v4M12 17h.01" /></Svg>;
export const SendIcon = (p: IconProps) => <Svg {...p}><path d="M4 12 20 4l-4 16-4-6.5zM12 13.5 20 4" /></Svg>;
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="M14.5 6 8.5 12l6 6" /></Svg>;
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M9.5 6l6 6-6 6" /></Svg>;
export const ChevronDownIcon = (p: IconProps) => <Svg {...p}><path d="M6 9.5l6 6 6-6" /></Svg>;
export const ArrowRightIcon = (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const SearchIcon = (p: IconProps) => <Svg {...p}><path d="M10.5 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15 15l4.5 4.5" /></Svg>;
/** the four sub-pages of the workbench, for its tab row */
export const PenIcon = (p: IconProps) => <Svg {...p}><path d="M15.5 4.5l4 4L9 19H5v-4zM13 7l4 4" /></Svg>;
export const MegaphoneIcon = (p: IconProps) => <Svg {...p}><path d="M4 10.5v3A1.5 1.5 0 0 0 5.5 15H7l9 4.5v-15L7 9H5.5A1.5 1.5 0 0 0 4 10.5zM7 15v4.5M19 10.5a3 3 0 0 1 0 3" /></Svg>;
export const CalendarIcon = (p: IconProps) => <Svg {...p}><path d="M5 6.5h14v13H5zM5 10.5h14M9 4v4M15 4v4" /></Svg>;
export const QuoteIcon = (p: IconProps) => <Svg {...p}><path d="M9.5 7.5C7 8.5 5.5 10.5 5.5 13.5V17h4.5v-4.5H7.5M18.5 7.5c-2.5 1-4 3-4 6V17H19v-4.5h-2.5" /></Svg>;
export const PeopleIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 19.5v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M12.7 8a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0M16.5 14.7a4 4 0 0 1 4 3.8v1M15.4 5.3a3.2 3.2 0 0 1 0 5.4" /></Svg>;
export const SlidersIcon = (p: IconProps) => <Svg {...p}><path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4" /></Svg>;
/** Studio's light and dark, for its switch */
export const SunIcon = (p: IconProps) => <Svg {...p}><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></Svg>;
export const MoonIcon = (p: IconProps) => <Svg {...p}><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" /></Svg>;
export const AutoThemeIcon = (p: IconProps) => <Svg {...p}><path d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" /></Svg>;
