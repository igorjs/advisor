// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { useEffect } from "react";

interface HotkeyOptions {
  /** The key to listen for (e.g. "k", "Enter", "Escape") */
  key: string;
  /** Require Ctrl (or Cmd on Mac) */
  ctrl?: boolean;
  /** Callback when the hotkey is pressed */
  onPress: () => void;
  /** Disable the hotkey (e.g. during loading) */
  enabled?: boolean;
}

/**
 * Global keyboard shortcut listener.
 * Legitimate useEffect: subscribing to window keydown (external system).
 *
 * Skips events when the user is typing in an input/textarea,
 * unless ctrl/cmd is held (so Ctrl+Enter works inside textarea).
 */
export function useHotkey({ key, ctrl = false, onPress, enabled = true }: HotkeyOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (ctrl && !ctrlOrMeta) return;
      if (!ctrl && ctrlOrMeta) return;
      if (e.key !== key) return;

      // Don't capture plain keys (no ctrl) when user is typing
      const target = e.target;
      if (!ctrl && target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }

      e.preventDefault();
      onPress();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, ctrl, onPress, enabled]);
}
