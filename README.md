# Advisor

Full-stack LLM advisor application. Submit prompts, receive structured advisory records, and manage them with CRUD operations.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 26 (LTS)
- [pnpm](https://pnpm.io/) >= 11

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

### Database Modes

By default, the app runs with a **local SQLite file** (no external services needed).

To connect to **Turso** for production/edge deployment, add these to your `.env`:

```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

When both are set, the app runs as an embedded replica with automatic sync.

## Scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Start both client and server in development mode |
| `pnpm test`        | Run all tests                                    |
| `pnpm test:watch`  | Run server tests in watch mode                   |
| `pnpm build`       | Build both client and server                     |
| `pnpm db:generate` | Generate a new database migration                |
| `pnpm db:migrate`  | Apply pending migrations                         |

## Project Structure

```
advisor/
├── client/          # React frontend (Vite + Tailwind)
├── server/          # Hono API server (Drizzle + Turso/libSQL)
├── docs/dev/        # Design decisions and implementation plan
└── package.json     # Root workspace configuration
```

## Tech Stack

- **Frontend:** React 19, @tanstack/react-query, Tailwind CSS 4, react-i18next, sonner
- **Backend:** Hono, Drizzle ORM, Turso/libSQL (local SQLite or remote), OpenAI SDK, Pino, zod 4
- **Testing:** Vitest with Hono `app.request()` integration tests
- **Language:** TypeScript 6 (strict mode)

## Design Docs

- [Requirements](docs/dev/requirements.md) - Initial project requirements for this project
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

Tests are organised by layer:

- **Unit:** Result/Option/pipe library, LLM service contract
- **Middleware:** error handler status mapping, rate limiter behaviour
- **Service:** prompt CRUD, record CRUD, re-query atomicity, LLM failure propagation
- **API Integration:** full HTTP request lifecycle via Hono `app.request()`
