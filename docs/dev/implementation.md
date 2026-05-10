# Implementation Plan

## Project Structure

```
advisor/
├── package.json                     # root: pnpm workspace scripts + Playwright
├── pnpm-workspace.yaml
├── playwright.config.ts
├── LICENSE                          # AGPL-3.0-only
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── drizzle/                     # migration SQL files
│   └── src/
│       ├── index.ts                 # entry: server start + graceful shutdown
│       ├── app.ts                   # Hono app assembly + middleware chain
│       ├── env.ts                   # zod env validation (fail-fast)
│       ├── config/                  # LLM, rate-limit, search, system prompt
│       ├── lib/                     # Result/Option, HTTP helpers, extractRecords
│       ├── db/                      # Drizzle schema, connection, migrations
│       ├── dto/                     # conversation + record DTOs
│       ├── middleware/              # 7 middleware (logging, security, CORS, etc.)
│       ├── routes/                  # conversations, records, chat (SSE), health
│       ├── services/               # agent loop, conversation, record, LLM, search
│       └── __tests__/              # 88 tests across 8 test files
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts              # @tailwindcss/vite plugin, /api proxy
│   ├── index.html
│   └── src/
│       ├── main.tsx                # providers: QueryClient, I18next, Toaster
│       ├── App.tsx                 # landing/chat layout, displayMessages derivation
│       ├── i18n.ts                 # i18n setup
│       ├── index.css               # @theme tokens, animations
│       ├── locales/en.json         # all UI strings
│       ├── types/api.ts            # ChatMessage, ConversationResponse, AgentEvent
│       ├── api/                    # fetch wrapper, conversations, records
│       ├── hooks/                  # useChatStream, useConversationId, useHotkey
│       └── components/             # ChatThread, ChatMessage, ChatInput, RecordCard, etc.
├── e2e/
│   └── advisor.spec.ts            # 17 Playwright e2e tests
└── docs/dev/                       # design decisions + this file
```

## Implementation Phases

### Phase 1: Foundation (v1)

- Monorepo scaffolding (pnpm workspaces)
- Result/Option library (pure-fx inspired), TDD
- Database schema (Drizzle + libSQL): prompts, records, idempotency_keys
- Server: middleware chain, prompt/record services, routes
- Client: PromptForm, RecordList, RecordCard with inline edit + delete
- Keyboard navigation (J/K), kbd hints, optimistic updates

### Phase 2: Agentic Chat (v2)

- Renamed prompts to conversations (multi-turn model)
- Agent service: LLM + web_search tool loop (max 5 rounds)
- SSE streaming chat endpoint
- Jina Search API integration
- Chat UI: ChatThread, ChatMessage, ChatInput
- Two-column layout: chat left, records right (React Activity)
- System prompt with conversational flow guidance

### Phase 3: Persistence and Polish (v3)

- Messages table: full history for LLM context and page refresh
- Two-phase records extraction (fallback LLM call for prose)
- Deterministic `[records:N]` sentinel, localised client rendering
- Inline message editing with truncation and version bumping
- Interview-style prompt (one question at a time)
- AGPL-3.0 license, SPDX headers, financial disclaimer
- Dark mode: system preference detection, class-based toggle, all components
- Persistent error toasts with code-aware messages (429, timeout, validation)
- Configurable rate limit via RATE_LIMIT_MAX env var (100 default)
- Playwright e2e test suite (30 tests: UI, dark mode, a11y, keyboard nav)
- axe-core accessibility audits (critical + serious violations)
- Expanded unit test coverage (53 to 88 tests)
- Chat UX: textarea, Enter/newline, Cmd+Enter submit, / hotkey, auto-focus

## Testing

### Unit + Integration (Vitest, 88 tests)

| Test file                | Count | Coverage                                                  |
| ------------------------ | ----- | --------------------------------------------------------- |
| result.test.ts           | 15    | Result/Option: Ok, Err, map, flatMap, match, fromNullable |
| extract-records.test.ts  | 14    | JSON extraction: clean, code fences, preamble, malformed  |
| conversation-dto.test.ts | 11    | toVisibleMessages: filters tools, preserves order         |
| llm.test.ts              | 3     | LLM service contract                                      |
| middleware.test.ts       | 7     | Error handler mapping, rate limiter                       |
| services.test.ts         | 18    | Conversation + record CRUD, re-query, not-found           |
| api.test.ts              | 10    | HTTP integration: create, get, patch, validation          |
| records-api.test.ts      | 10    | Records PATCH/DELETE: update, 400, 404                    |

### End-to-End (Playwright + axe-core, 30 tests)

Real server, real DB, real LLM. `test.slow()` for multi-turn flows.

| Suite                | Count | Coverage                                        |
| -------------------- | ----- | ----------------------------------------------- |
| Landing Page         | 2     | Title, form, button states                      |
| Conversation Flow    | 4     | Submit, URL routing, AI response, follow-up     |
| Records Panel        | 1     | Multi-turn interview to records, edit/delete     |
| Page Refresh         | 2     | Message persistence, sentinel rendering         |
| New Chat             | 2     | Return to landing, message clearing             |
| Chat Input UX        | 3     | Enter/newline, focus, button state              |
| Message Editing      | 2     | Edit form, escape cancel                        |
| URL Routing + Errors | 1     | 404 error display                               |
| Dark Mode            | 4     | System preference, toggle, visibility both views |
| Accessibility        | 4     | axe-core critical + serious, light + dark mode  |
| Keyboard Navigation  | 5     | / focus, Escape, Cmd+Enter, Tab traversal       |
