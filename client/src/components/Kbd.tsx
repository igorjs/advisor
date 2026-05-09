// Detect Mac once at module load for consistent rendering
const isMac = navigator.userAgent.includes("Mac");

/** Platform-aware modifier key label. */
export const modKey = isMac ? "⌘" : "Ctrl";

// Individual key cap: dark, rounded, embossed look.
// Hidden on small screens where physical keyboards are rare.
function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.4em] items-center justify-center rounded-[5px] border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  );
}

/**
 * Renders a keyboard shortcut as styled key caps.
 * Splits on "+" to render each key separately: "Ctrl+K" → [Ctrl] + [K]
 */
export function Kbd({ children }: { children: string }) {
  const parts = children.split("+");

  return (
    <span className="ml-1.5 hidden items-center gap-0.5 sm:inline-flex">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="text-[10px] text-gray-400">+</span>}
          <Key>{part}</Key>
        </span>
      ))}
    </span>
  );
}
