# Design Decisions

## Overview

Full-stack agentic LLM advisor. Users start a conversation, the AI interviews them about their client's situation (one question at a time), searches the web for current tax rules, and produces structured advisory records. Users can review, edit, and delete records in a side panel.

## Technology Choices

| Layer           | Choice                | Why                                                                                          |
| --------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| Package manager | pnpm workspaces       | Built-in orchestration, strict dependency resolution, disk efficient                         |
| Backend         | Hono                  | Lightweight, fast, built-in middleware, excellent testing via `app.request()`                |
| ORM             | Drizzle               | Type-safe queries, libSQL/Turso support, versioned migrations                                |
| Database        | Turso (libSQL)        | SQLite-compatible. Local file for dev, Turso remote for production. Zero-config locally.     |
| LLM             | OpenAI SDK            | Provider-agnostic via `baseURL` (compatible with OpenRouter, Google AI Studio, Ollama, etc.) |
| Web Search      | Jina Search API       | Full content extraction from search results, used by the agent for research                  |
| Frontend        | React 19 + Vite 8     | Standard tooling, fast HMR, React 19 Activity component for preserving panel state           |
| Data fetching   | @tanstack/react-query | Caching, optimistic updates, retry, stale-while-revalidate                                   |
| Styling         | Tailwind CSS 4        | `@tailwindcss/vite` plugin, `@theme` directive for design tokens, no PostCSS config          |
| Toasts          | sonner                | Lightweight (3KB), error-only notifications                                                  |
| i18n            | react-i18next         | Low setup cost now, painful retrofit later                                                   |
| Testing         | Vitest + Playwright   | Vitest for unit/integration, Playwright for e2e against real server                          |

## API Design

### Versioned, nested resources

```
GET    /api/health
POST   /api/v1/conversations
GET    /api/v1/conversations/:id                 # includes records + visible messages
PATCH  /api/v1/conversations/:id                 # re-query
POST   /api/v1/conversations/:id/chat            # SSE: send message, agentic loop
POST   /api/v1/conversations/:id/edit/:messageId # SSE: edit + truncate + re-run
PATCH  /api/v1/conversations/:id/records/:id
DELETE /api/v1/conversations/:id/records/:id
```

Records are owned by conversations. The nested URL reflects this real relationship.

### Response shapes

Success: `{ data: T }` where T includes `records[]` and `messages[]` for conversations.
Error: `{ error: { code: string, message: string, details?: unknown[] } }`

### SSE Events (chat endpoint)

The chat endpoint streams agent events as Server-Sent Events:

| Event             | Payload             | Purpose                        |
| ----------------- | ------------------- | ------------------------------ |
| `assistant_delta` | `{ content }`       | Incremental text (streaming)   |
| `assistant_end`   | `{ fullContent }`   | Complete assistant message     |
| `tool_start`      | `{ name, query }`   | Web search initiated           |
| `tool_result`     | `{ results }`       | Search results count           |
| `records`         | `{ records[] }`     | Structured strategies produced |
| `error`           | `{ code, message }` | Error during processing        |
| `done`            | `{}`                | Stream complete                |

## Error Handling Philosophy

Inspired by [pure-fx](https://github.com/igorjs/pure-fx): errors are values, not exceptions.

### Result pattern

Services return `Result<T, E>` instead of throwing:

- `Ok(value)` wraps a successful value
- `Err(error)` wraps a typed error
- Routes use `matchResult()` to map Result variants to HTTP responses
- No try/catch in route handlers

### Option pattern

For nullable lookups:

- `Some(value)` wraps a present value
- `None` represents absence
- `fromNullable(row)` bridges DB nullable returns
- `.toResult(error)` converts Option to Result for early returns

### Type safety

- **No `as` type assertions** anywhere in the codebase
- **No `!` non-null assertions**: null checks with proper error returns
- **No `any`**: strict TypeScript 6 with `noUncheckedIndexedAccess`
- **`null` over `undefined`**: for V8 hidden class performance

## Database Schema

```sql
conversations (
  id, public_id, user_id?, title,
  deleted_at?, created_at, updated_at
)

messages (
  id, public_id, conversation_id FK, role, content,
  version, tool_calls?, tool_call_id?,
  created_at
)

records (
  id, public_id, conversation_id FK, user_id?,
  title, description, version,
  deleted_at?, created_at, updated_at
)

idempotency_keys (
  key PK, endpoint, response, created_at
)
```

Key decisions:

- **Conversations (not prompts)**: renamed to reflect multi-turn nature. The first user message serves as the title.
- **Messages table**: stores full conversation history for LLM context. `role` is user/assistant/tool. `version` tracks edit forks. `tool_calls` stores LLM tool call requests (JSON).
- **Visible message filtering**: `toVisibleMessages()` in the DTO excludes tool results and tool-call requests, showing only user messages and assistant text responses.
- **Records sentinel**: when the agent produces records, the assistant message is saved as `[records:N]` (a deterministic sentinel). The client renders this as localised text ("I've prepared N strategies..."). This prevents raw JSON or markdown from leaking into the chat on page refresh.
- **Version field**: messages and records track versions. When a user edits a message, subsequent messages are truncated and the version bumps. Records from older versions become stale.
- **Soft deletes** (`deleted_at`): audit trail for future SaaS.
- **FK cascade delete**: conversation deletion cascades to messages and records.

## Agentic Architecture

The agent service (`agent.service.ts`) runs a multi-turn agentic loop:

1. Save user message to DB
2. Load full conversation history
3. Call LLM with history + web_search tool
4. If LLM requests tool calls: execute searches via Jina, save results, loop back to step 3
5. If LLM returns text:
   a. Try `extractRecords()` for JSON
   b. If no JSON but looks like strategies (>200 chars, no trailing `?`): make a second LLM call with `response_format: json_object` to convert prose to records
   c. If records found: save sentinel, insert records, yield `assistant_end` + `records` events
   d. If no records: save as follow-up question, yield `assistant_end`
6. Max 5 tool-call rounds to prevent infinite loops

### Two-phase records extraction

Models don't always return JSON even when instructed. The fallback extraction:

1. `extractRecords(content)`: strip code fences, find outermost `{}`, parse with zod
2. If null and `looksLikeStrategies(content)`: call LLM with `EXTRACTION_PROMPT` and `json_object` format
3. Require `records.length > 0` to prevent empty-array false positives

## Frontend Architecture

### Layout

```
Landing page (/)           Chat view (/chat/:id)
┌──────────────────┐      ┌──────┬──────────────┐
│                  │      │Header│ + New Chat    │
│   Title + Form   │  =>  ├──────┤──────────────┤
│   (centred)      │      │ Chat │ Records panel │
│                  │      │      │ (when ready)  │
└──────────────────┘      ├──────┤              │
                          │Input │              │
                          └──────┴──────────────┘
```

### Component tree

```
App
├── ThemeToggle (sun/moon, top-right on both views)
├── PromptForm (landing)
└── Chat view
    ├── ChatThread
    │   └── ChatMessage (user/assistant/tool + sentinel rendering)
    ├── ChatInput (textarea, /, Cmd+Enter, auto-resize)
    └── RecordList (Activity panel)
        ├── RecordCard (inline edit + y/N delete)
        ├── RecordSkeleton
        └── EmptyState
```

### State management

- **React Query**: server state (conversations, records). Caching, optimistic updates, invalidation on SSE `records` event.
- **useChatStream**: local streaming state (messages, isStreaming). Hydrated from server on page refresh via `displayMessages` derivation.
- **useConversationId**: URL-backed state (`/chat/:id`). Simple pushState/popstate, no router library needed yet.
- **No useEffect**: except `popstate` listener (external system sync) and `keydown` listener for hotkeys. All other state is derived during render or driven by event handlers.

## Security

- **Prompt injection**: system prompt with clear boundaries, input length limits (5000 chars)
- **XSS**: no `dangerouslySetInnerHTML`, plain text rendering only
- **Rate limiting**: in-memory per-IP on mutation endpoints
- **Idempotency**: `Idempotency-Key` header on POST mutations to prevent duplicate LLM calls
- **Secure headers**: CSP, X-Frame-Options via Hono middleware
- **Input validation**: zod on every boundary (env, API input, LLM response)
- **Rate limiting**: configurable via `RATE_LIMIT_MAX` env (100 default dev, 10-20 production)

## Dark Mode

- **System preference**: inline `<script>` in `<head>` checks `prefers-color-scheme` before React renders, preventing flash of wrong theme
- **Class-based**: `@variant dark (&:where(.dark, .dark *))` in Tailwind CSS 4 overrides the built-in `@media` variant
- **Toggle**: `ThemeToggle` component uses `useSyncExternalStore` to track `.dark` on `<html>`. Session-only override: refresh resets to system preference
- **Coverage**: all 12 component files have `dark:` variants for backgrounds, text, borders, focus rings, hover states, disabled states, and placeholders

## Testing Strategy

### Unit + Integration (88 tests, Vitest)

- **RED/GREEN TDD** with BDD/AAA pattern
- Result/Option library, extractRecords JSON parsing, DTO message filtering
- Service-level CRUD with in-memory SQLite
- Full HTTP lifecycle via Hono `app.request()`
- Records PATCH/DELETE routes with seeded test data

### End-to-End (30 tests, Playwright + axe-core)

- Real server, real DB, real LLM calls
- Landing page, conversation flow, records panel, page refresh
- Dark mode: system preference detection, toggle, visibility
- Accessibility: axe-core audit (critical + serious violations) on landing, chat, and dark mode
- Keyboard navigation: `/` focus, Escape cancel, Cmd+Enter submit, Tab traversal
- `test.slow()` for multi-turn tests that make multiple LLM calls
