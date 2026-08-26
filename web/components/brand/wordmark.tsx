// "eLLVate" set in the site's own name -- pairs with CactusMark wherever
// the logo lockup appears (nav, footer, legal-page header). LLV is styled
// separately so the Lake Las Vegas pun survives even where capitalization
// doesn't (see the .wordmark-llv comment in globals.css).
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className ?? ''}`}>
      e<span className="wordmark-llv">LLV</span>ate
    </span>
  );
}
