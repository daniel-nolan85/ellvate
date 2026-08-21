// Temporary wordmark icon -- Community Copilot's real logo is being designed
// separately (see conversation with Daniel, 2026-08-20) and will replace
// this. Reuses the same desert-saguaro-in-sunglasses character and palette
// as the mobile app's loading spinner (../../../src/components/ui/spinner)
// so the site reads as the same brand in the meantime, just in a static
// standing pose instead of the spinner's dancing one.
export function CactusMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      className={className}
      fill="none"
      aria-hidden
    >
      <ellipse cx="12" cy="23" rx="7" ry="1.4" fill="#251e17" opacity="0.12" />
      <rect x="3.5" y="6" width="3.4" height="8" rx="1.7" fill="#6e7f4a" />
      <rect x="3.5" y="11.5" width="6.3" height="3.4" rx="1.7" fill="#6e7f4a" />
      <rect x="17.1" y="2" width="3.4" height="8" rx="1.7" fill="#6e7f4a" />
      <rect x="14.2" y="7.3" width="6.3" height="3.4" rx="1.7" fill="#6e7f4a" />
      <rect x="9.3" y="5" width="5.4" height="17" rx="2.7" fill="#6e7f4a" />
      <g stroke="#d97b29" strokeLinecap="round" strokeWidth="0.35">
        <line x1="3.6" y1="7.5" x2="2.7" y2="7.1" />
        <line x1="3.6" y1="10.5" x2="2.7" y2="10.1" />
        <line x1="3.6" y1="13" x2="2.7" y2="12.6" />
        <line x1="20.4" y1="3.5" x2="21.3" y2="3.1" />
        <line x1="20.4" y1="6" x2="21.3" y2="5.6" />
        <line x1="20.4" y1="8.5" x2="21.3" y2="8.1" />
        <line x1="9.5" y1="13" x2="8.6" y2="13.5" />
        <line x1="9.5" y1="16" x2="8.6" y2="16.5" />
        <line x1="9.5" y1="19" x2="8.6" y2="19.5" />
        <line x1="14.5" y1="14.5" x2="15.4" y2="15" />
        <line x1="14.5" y1="17.5" x2="15.4" y2="18" />
        <line x1="14.5" y1="20.5" x2="15.4" y2="21" />
      </g>
      <rect x="9.3" y="8.2" width="0.6" height="0.4" rx="0.2" fill="#251e17" />
      <rect x="14.15" y="8.2" width="0.6" height="0.4" rx="0.2" fill="#251e17" />
      <rect x="11.55" y="8" width="0.9" height="0.55" rx="0.25" fill="#251e17" />
      <circle cx="10.9" cy="8.4" r="1.05" fill="#251e17" />
      <circle cx="13.1" cy="8.4" r="1.05" fill="#251e17" />
      <ellipse cx="10.55" cy="8.05" rx="0.32" ry="0.2" fill="#fdf7ed" opacity="0.85" />
      <ellipse cx="12.75" cy="8.05" rx="0.32" ry="0.2" fill="#fdf7ed" opacity="0.85" />
      <path d="M 10.6 10.3 Q 12 11.3 13.4 10.3" stroke="#3a3222" strokeLinecap="round" strokeWidth="0.55" fill="none" />
    </svg>
  );
}
