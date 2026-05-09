// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import {
  SEARCH_API_URL,
  SEARCH_MAX_RESULTS,
  SEARCH_TIMEOUT_MS,
} from "../config/search.js";
import { Err, Ok, type Result } from "../lib/result.js";
import type { DomainError } from "../lib/types.js";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchService {
  search(
    query: string,
    site: string | null,
  ): Promise<Result<SearchResult[], DomainError>>;
}

/**
 * Jina Search returns full extracted page content (not just snippets),
 * so the LLM gets rich source material to cite accurate figures.
 * The LLM decides what to search and whether to filter by site.
 */
export function createSearchService(apiKey: string): SearchService {
  return {
    async search(query, site) {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        // Site-scoped search (e.g. "site:ato.gov.au") via Jina's X-Site header
        if (site) {
          headers["X-Site"] = site;
        }

        const response = await fetch(SEARCH_API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            q: query,
            num: SEARCH_MAX_RESULTS,
          }),
          signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        });

        if (!response.ok) {
          return Err({
            code: "LLM_ERROR",
            message: `Search API error: ${response.status} ${response.statusText}`,
          });
        }

        const json = await response.json() as {
          data: Array<{
            title: string;
            url: string;
            content: string;
          }>;
        };

        const results: SearchResult[] = (json.data ?? []).map((item) => ({
          title: item.title ?? "",
          url: item.url ?? "",
          // Truncate to keep token usage reasonable
          content: (item.content ?? "").slice(0, 3000),
        }));

        return Ok(results);
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          return Err({
            code: "LLM_TIMEOUT",
            message: "Search request timed out.",
          });
        }

        return Err({
          code: "LLM_ERROR",
          message: error instanceof Error ? error.message : "Search failed.",
        });
      }
    },
  };
}
