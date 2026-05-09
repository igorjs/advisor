// Detect Mac once at module load for consistent rendering
const isMac = navigator.userAgent.includes("Mac");

/** Platform-aware modifier key label. */
export const modKey = isMac ? "⌘" : "Ctrl";

// Visual keyboard shortcut hint. Rendered inline next to buttons
// so users discover shortcuts without needing documentation.
// Hidden on small screens where physical keyboards are rare.
export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1.5 hidden rounded border border-gray-300 bg-gray-50 px-1 py-0.5 font-mono text-[10px] text-gray-400 sm:inline-block">
      {children}
    </kbd>
  );
}
