# Implementation Plan

## Project Structure

```
advisor/
├── package.json                     # root: pnpm workspace scripts
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── drizzle.config.ts
│   └── src/
│       ├── index.ts                 # entry: server start + graceful shutdown
│       ├── app.ts                   # Hono app assembly + middleware chain
│       ├── env.ts                   # zod env validation
│       ├── lib/
│       │   ├── result.ts            # Result<T,E>, Option<T>, pipe, tryCatch
│       │   └── types.ts             # shared domain types, AppContext
│       ├── db/
│       │   ├── index.ts             # Turso/libSQL connection (local file or remote)
│       │   ├── schema.ts            # Drizzle table definitions
│       │   └── migrations/          # versioned SQL files
│       ├── middleware/
│       │   ├── context.ts           # AppContext injection (stub for auth)
│       │   ├── logger.ts            # Pino + request/correlation IDs
│       │   ├── security.ts          # secure-headers
│       │   ├── cors.ts              # CORS config
│       │   ├── rate-limiter.ts      # in-memory per-IP
│       │   ├── error-handler.ts     # structured error responses
│       │   └── idempotency.ts       # Idempotency-Key deduplication
│       ├── routes/
│       │   ├── health.ts            # GET /api/health
│       │   ├── prompts.ts           # prompt endpoints
│       │   └── records.ts           # record endpoints
│       ├── services/
│       │   ├── prompt.service.ts    # prompt CRUD + re-query
│       │   ├── record.service.ts    # record CRUD
│       │   └── llm.service.ts       # OpenAI SDK + structured output
│       ├── dto/
│       │   ├── prompt.dto.ts        # DB -> API response mapping
│       │   └── record.dto.ts        # DB -> API response mapping
│       └── __tests__/
│           ├── prompts.test.ts
│           ├── records.test.ts
│           └── llm.test.ts
│
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx                 # providers: QueryClient, I18next, Toaster
│       ├── App.tsx
│       ├── i18n.ts
│       ├── locales/
│       │   └── en.json
│       ├── types/
│       │   └── api.ts               # API response types
│       ├── api/
│       │   ├── client.ts            # fetch wrapper + idempotency key
│       │   ├── prompts.ts
│       │   └── records.ts
│       ├── hooks/
│       │   ├── usePrompts.ts        # react-query hooks
│       │   └── useRecords.ts        # react-query hooks (optimistic)
│       └── components/
│           ├── PromptForm.tsx
│           ├── RecordList.tsx
│           ├── RecordCard.tsx
│           ├── RecordSkeleton.tsx
│           ├── EmptyState.tsx
│           └── ErrorBanner.tsx
│
└── docs/
    └── dev/
        ├── design.md
        └── implementation.md
```

## Implementation Order

### Phase 1: Foundation

**1.1 Project scaffolding**

- Root `package.json` with pnpm workspace scripts
- `pnpm-workspace.yaml` declaring client/ and server/
- `.gitignore` (node_modules, dist, .env, *.sqlite, .local/)
- `.env.example` (OPENAI_API_KEY, PORT, DATABASE_URL)

**1.2 Server package + database layer**

- `server/package.json` with dependencies
- `server/tsconfig.json` (strict mode)
- `src/env.ts`: zod env schema, fail-fast validation
- `src/db/schema.ts`: Drizzle tables (prompts, records, idempotency_keys)
- `src/db/index.ts`: SQLite connection with WAL mode
- `drizzle.config.ts` + generate initial migration

**1.3 Result/Option library**

- `src/lib/result.ts`: lightweight Result<T,E>, Option<T>, tryCatch
- Inspired by pure-fx but minimal (no monadic chains, just the core pattern)
- Tests first (RED/GREEN)

### Phase 2: Server

**2.1 Types, DTOs, and middleware**

- `src/lib/types.ts`: AppContext, domain error types
- `src/dto/prompt.dto.ts` + `src/dto/record.dto.ts`
- All 7 middleware files
- Tests for error handler and rate limiter

**2.2 Services**

- `src/services/llm.service.ts`: OpenAI + zodResponseFormat + 30s timeout
- `src/services/prompt.service.ts`: CRUD + re-query (transaction)
- `src/services/record.service.ts`: CRUD (soft delete filter)
- All return Result<T, E>, never throw
- Tests first (mocked OpenAI for LLM, in-memory SQLite for CRUD)

**2.3 Routes + app assembly**

- `src/routes/health.ts`, `prompts.ts`, `records.ts`
- `src/app.ts`: middleware chain assembly
- `src/index.ts`: entry point + graceful shutdown
- Integration tests via `app.request()`

### Phase 3: Client

**3.1 Client foundation**

- Package setup, Vite + Tailwind + PostCSS config
- i18n setup, providers, entry point

**3.2 API layer + hooks**

- Types, fetch wrapper, API functions
- react-query hooks with optimistic updates

**3.3 Components**

- Build bottom-up: EmptyState, ErrorBanner, RecordSkeleton first
- Then RecordCard (inline editing), RecordList, PromptForm
- Finally App.tsx composition

### Phase 4: Polish

**4.1 Testing + final verification**

- Ensure all tests pass
- Verify full stack: `pnpm install && pnpm dev`

**4.2 README**

- How to run the project
- Point to docs/dev/ for design decisions

## Error Handling Pattern (pure-fx inspired)

Every service method returns `Result<T, DomainError>`:

```typescript
// Service
async function getPrompt(publicId: string): Promise<Result<Prompt, DomainError>> {
  const prompt = await db.query...
  if (!prompt) return Err({ code: 'NOT_FOUND', message: '...' })
  return Ok(toPromptResponse(prompt))
}

// Route
app.get('/api/v1/prompts/:publicId', async (c) => {
  const result = await promptService.getPrompt(c.req.param('publicId'))
  if (!result.ok) {
    return c.json({ error: result.error }, mapErrorToStatus(result.error.code))
  }
  return c.json({ data: result.value })
})
```

No try/catch in routes. Errors flow as typed values through the system.

## Testing Approach

### RED/GREEN TDD cycle

1. Write a failing test describing expected behaviour
2. Implement the minimum code to make it pass
3. Refactor if needed

### BDD style

Tests describe behaviour from the consumer's perspective:

```typescript
describe("POST /api/v1/prompts", () => {
  it("creates a prompt and returns structured records", async () => {
    // Arrange
    const body = { text: "Give me tax advice" };

    // Act
    const res = await app.request("/api/v1/prompts", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    // Assert
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toHaveProperty("publicId");
    expect(json.data.records).toBeInstanceOf(Array);
  });
});
```

### What we test

- HTTP status codes and response shapes
- API contracts (required fields, types)
- Error responses for invalid input
- Business rules (re-query deletes old records)

### What we don't test

- Internal function signatures
- Database row structures
- Middleware ordering
- Implementation details
