# Advisor

Full-stack LLM advisor application. Submit prompts, receive structured advisory records, and manage them with CRUD operations.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run database migrations
pnpm db:migrate

# Start development servers (client + server)
pnpm dev
```

The client runs at [http://localhost:5173](http://localhost:5173) and proxies API requests to the server on port 3001.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both client and server in development mode |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run server tests in watch mode |
| `pnpm build` | Build both client and server |
| `pnpm db:generate` | Generate a new database migration |
| `pnpm db:migrate` | Apply pending migrations |

## Project Structure

```
advisor/
├── client/          # React frontend (Vite + Tailwind)
├── server/          # Hono API server (Drizzle + SQLite)
├── docs/dev/        # Design decisions and implementation plan
└── package.json     # Root workspace configuration
```

## Tech Stack

- **Frontend:** React, @tanstack/react-query, Tailwind CSS, react-i18next, sonner
- **Backend:** Hono, Drizzle ORM, SQLite (WAL mode), OpenAI SDK, Pino, zod
- **Testing:** Vitest with Hono `app.request()` integration tests

## Design Docs

- [Design Decisions](docs/dev/design.md) - Architecture, API design, error handling philosophy
- [Implementation Plan](docs/dev/implementation.md) - File structure, build order, testing approach

## API Endpoints

```
GET    /api/health                                    Health check
POST   /api/v1/prompts                                Create a prompt (triggers LLM)
GET    /api/v1/prompts/:publicId                      Get a prompt with records
PATCH  /api/v1/prompts/:publicId                      Re-query with updated text
GET    /api/v1/prompts/:publicId/records               List records
PATCH  /api/v1/prompts/:publicId/records/:recordId     Update a record
DELETE /api/v1/prompts/:publicId/records/:recordId     Delete a record
```

## Testing

```bash
# Run all tests
pnpm test

# Run with watch mode
pnpm test:watch
```

71 tests covering:
- Result/Option type behaviour (31 tests)
- Middleware: error handler, rate limiter (8 tests)
- Service contracts: prompt CRUD, record CRUD, LLM failures (19 tests)
- API integration: full HTTP lifecycle via `app.request()` (13 tests)
