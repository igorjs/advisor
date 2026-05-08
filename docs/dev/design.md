# Design Decisions

## Overview

Full-stack LLM advisor application. Users submit prompts, receive structured advisory records, and perform CRUD operations on them. The architecture is designed for a future multi-tenant SaaS evolution, though the MVP is single-user.

## Technology Choices

| Layer | Choice | Why |
|-------|--------|-----|
| Package manager | pnpm workspaces | Built-in orchestration, strict dependency resolution, disk efficient |
| Backend | Hono | Lightweight, fast, built-in middleware, excellent testing via `app.request()` |
| ORM | Drizzle | Type-safe queries, libSQL/Turso support, versioned migrations |
| Database | Turso (libSQL) | SQLite-compatible. Local file mode for development, Turso remote for production. Zero-config locally, production-ready with edge replication when Turso credentials are set. |
| LLM | OpenAI SDK | Provider-agnostic API shape (compatible with Ollama, Groq, etc.) |
| Frontend | React + Vite | Standard tooling, fast HMR |
| Data fetching | @tanstack/react-query | Required by brief. Provides caching, optimistic updates, retry |
| Styling | Tailwind CSS | Mobile-first, utility classes, design token centralisation |
| Toasts | sonner | Lightweight (3KB), pairs with future shadcn/ui adoption |
| i18n | react-i18next | Low setup cost now, painful retrofit later |
| Testing | Vitest | Same ecosystem as Vite, fast, TypeScript-native |

## API Design

### Versioned, nested resources

```
GET    /api/health
POST   /api/v1/prompts
GET    /api/v1/prompts/:publicId
PATCH  /api/v1/prompts/:publicId                          # re-query
GET    /api/v1/prompts/:publicId/records
PATCH  /api/v1/prompts/:publicId/records/:recordPublicId
DELETE /api/v1/prompts/:publicId/records/:recordPublicId
```

Records are owned by prompts. The nested URL reflects this real relationship.

### Response shapes

Success: `{ data: T, meta?: { total, page, pageSize } }`
Error: `{ error: { code: string, message: string, details?: unknown[] } }`

### UUID public IDs

External APIs expose UUID-style `publicId`, not auto-increment integers. Prevents enumeration attacks and makes future multi-tenant ID isolation straightforward.

## Error Handling Philosophy

Inspired by [pure-fx](https://github.com/igorjs/pure-fx): errors are values, not exceptions.

### Result pattern

Services return `Result<T, E>` instead of throwing:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

- `Ok(value)` wraps a successful value
- `Err(error)` wraps a typed error
- Routes use pattern matching to map Result variants to HTTP responses
- No try/catch in route handlers, only in the boundary where external code (OpenAI SDK, DB) is called

### Option pattern

For nullable lookups:

```typescript
type Option<T> = { some: true; value: T } | { some: false }
```

- `Some(value)` wraps a present value
- `None` represents absence
- Used for database lookups that may return no rows (e.g. "find prompt by publicId")
- Eliminates null checks in favour of explicit handling

### Boundary wrapping

External code that throws (OpenAI SDK, JSON parsing) is wrapped with `tryCatch()` at the boundary, converting exceptions into Result values. Internal code never throws.

## Database Schema

```sql
prompts (
  id, public_id, user_id?, text,
  deleted_at?, created_at, updated_at
)

records (
  id, public_id, prompt_id FK, user_id?, title, description,
  deleted_at?, created_at, updated_at
)

idempotency_keys (
  key PK, endpoint, response, created_at
)
```

Key decisions:
- **Turso/libSQL**: local file mode (`file:data/advisor.db`) when no Turso credentials are set. When `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are provided, operates as an embedded replica with edge sync. This enables a smooth path to multi-tenant SaaS: each tenant could get their own Turso database, resolved at connection time.
- **Nullable `user_id`**: future multi-tenant without schema migration
- **Soft deletes** (`deleted_at`): audit trail for future SaaS. Drizzle query helper enforces the filter globally.
- **FK cascade delete**: prompt deletion cascades to records
- **Re-query**: UPDATE prompt text + DELETE old records + INSERT new records. Preserves prompt identity (stable publicId).

## Backend Architecture

```
routes -> middleware -> services -> drizzle
```

- **Routes**: thin, validation + delegation only
- **Middleware**: context stub (future auth), Pino logger, secure headers, CORS, rate limiter, error handler, idempotency
- **Services**: business logic, return Result<T, E>
- **DTOs**: map DB rows to API response shapes (DB schema !== API contract)

### Middleware chain

1. Logger (Pino + request correlation ID)
2. Secure headers (`hono/secure-headers`)
3. CORS (restricted to client origin)
4. Context (stub: `{ userId: null }`, future auth populates this)
5. Error handler (catches unhandled errors, formats as structured response)

Rate limiter and idempotency are applied per-route on mutations.

## Frontend Architecture

```
App
  PromptForm          # textarea + submit, disabled during loading
  RecordList          # handles loading/error/empty states
    RecordCard        # inline edit + delete
    RecordSkeleton    # pulse-animated placeholder
    EmptyState        # "Submit a prompt to get started"
    ErrorBanner       # inline error with retry
```

- **Inline editing**: no modals. Edit where you read.
- **Optimistic updates**: react-query `onMutate` for instant UI feedback, rollback on error
- **Skeleton loaders**: 3-4 placeholder cards during LLM calls
- **Toasts**: sonner for CRUD feedback

## Validation

Zod at every boundary:
- **Env**: fail-fast on startup if OPENAI_API_KEY missing
- **API input**: request body/params validated in route handlers
- **LLM response**: structured output via `zodResponseFormat`, `safeParse` on response
- **Forms**: client-side validation before submission

## Security

The assessment says "no security required", but this is an LLM app with real attack surface:

- **Prompt injection**: system prompt with boundaries, input length limits, structured output enforcement
- **XSS**: no `dangerouslySetInnerHTML`, plain text rendering only
- **Rate limiting**: in-memory per-IP on mutation endpoints (LLM calls cost money)
- **Secure headers**: CSP, X-Frame-Options via Hono middleware
- **Input sanitisation**: control character stripping, max length via zod

## Future-Proofing (designed for, not implemented)

- Multi-tenant data isolation (nullable `user_id` ready)
- RBAC/ABAC (context middleware slot)
- Authentication (middleware chain designed for it)
- shadcn/ui component library (Radix + Tailwind foundation)
- Mobile-first responsive (Tailwind default)

## Testing Strategy

- **RED/GREEN TDD**: write failing tests first, implement to pass
- **BDD**: test behaviour and contracts, not implementation details
- **AAA pattern**: Arrange, Act, Assert
- **Server**: Vitest + Hono `app.request()` for integration, `vi.mock()` for unit
- **Assertions**: test HTTP responses, status codes, response shapes. Never test internal state.
