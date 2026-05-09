import { useCallback, useEffect, useState } from "react";

// URL pattern: /p/:publicId for a prompt, / for new
function readFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/p\/(.+)$/);
  return match?.[1] ?? null;
}

function writeToUrl(id: string | null): void {
  const path = id ? `/p/${id}` : "/";
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
}

/**
 * Stores the active prompt ID in the URL path so results are bookmarkable.
 * Handles browser back/forward via popstate listener.
 *
 * We only have two routes (/ and /p/:id), so a full router (TanStack Router,
 * React Router) would add ~12KB and config overhead for no real benefit.
 * This hook covers pushState, popstate, and URL parsing in 35 lines.
 * Swap to a proper router when a third route appears.
 */
export function usePromptId() {
  const [promptId, setPromptIdState] = useState(readFromUrl);

  const setPromptId = useCallback((id: string | null) => {
    setPromptIdState(id);
    writeToUrl(id);
  }, []);

  // Sync state when user navigates with back/forward buttons
  useEffect(() => {
    const handler = () => setPromptIdState(readFromUrl());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return [promptId, setPromptId] as const;
}
