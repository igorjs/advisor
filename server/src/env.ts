import { z } from "zod";

const envSchema = z.object({
  // LLM provider (OpenAI-compatible: OpenAI, OpenRouter, Ollama, etc.)
  LLM_API_KEY: z.string().min(1, "LLM_API_KEY is required"),
  LLM_BASE_URL: z.string().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default("file:data/advisor.db"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  // Jina Search API for web research (s.jina.ai)
  JINA_API_KEY: z.string().min(1, "JINA_API_KEY is required"),
  // Turso credentials (optional: when absent, runs as local SQLite)
  TURSO_DATABASE_URL: z.string().nullable().default(null),
  TURSO_AUTH_TOKEN: z.string().nullable().default(null),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error("Environment validation failed:\n" + formatted);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
