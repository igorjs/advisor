// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

// LLM request behaviour. Tuned for structured output from OpenAI-compatible APIs.
// 30s is generous but necessary: smaller models and free tiers can be slow,
// while the default SDK timeout (10min) wastes user attention.
export const LLM_TIMEOUT_MS = 30_000;
