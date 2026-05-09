// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { DomainException } from "../lib/errors.js";
import { errorHandler } from "../middleware/error-handler.js";
import { createRateLimiter } from "../middleware/rate-limiter.js";
import { jsonBody } from "./helpers.js";

interface ErrorData {
  error: { code: string; message: string; details?: Array<Record<string, string>> };
}

describe("error-handler", () => {
  function createApp() {
    const app = new Hono();
    app.onError(errorHandler);
    return app;
  }

  it("returns structured error for domain exceptions", async () => {
    // Arrange
    const app = createApp();
    app.get("/fail", () => {
      throw new DomainException({ code: "NOT_FOUND", message: "Prompt not found" });
    });

    // Act
    const res = await app.request("/fail");

    // Assert
    expect(res.status).toBe(404);
    const body = await jsonBody<ErrorData>(res);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Prompt not found");
  });

  it("returns 500 for unexpected errors", async () => {
    // Arrange
    const app = createApp();
    app.get("/crash", () => {
      throw new Error("unexpected");
    });

    // Act
    const res = await app.request("/crash");

    // Assert
    expect(res.status).toBe(500);
    const body = await jsonBody<ErrorData>(res);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns 400 for validation domain exceptions", async () => {
    // Arrange
    const app = createApp();
    app.get("/validate", () => {
      throw new DomainException({
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: [{ field: "text", issue: "required" }],
      });
    });

    // Act
    const res = await app.request("/validate");

    // Assert
    expect(res.status).toBe(400);
    const body = await jsonBody<ErrorData>(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toHaveLength(1);
  });

  it("returns 429 for rate limited domain exceptions", async () => {
    // Arrange
    const app = createApp();
    app.get("/limited", () => {
      throw new DomainException({ code: "RATE_LIMITED", message: "Too many requests" });
    });

    // Act
    const res = await app.request("/limited");

    // Assert
    expect(res.status).toBe(429);
  });

  it("returns 504 for LLM timeout domain exceptions", async () => {
    // Arrange
    const app = createApp();
    app.get("/timeout", () => {
      throw new DomainException({ code: "LLM_TIMEOUT", message: "LLM timed out" });
    });

    // Act
    const res = await app.request("/timeout");

    // Assert
    expect(res.status).toBe(504);
  });
});

describe("rate-limiter", () => {
  function createApp(maxRequests: number, windowMs: number) {
    const app = new Hono();
    app.use("*", createRateLimiter(maxRequests, windowMs));
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  }

  it("allows requests under the limit", async () => {
    // Arrange
    const app = createApp(3, 60_000);

    // Act
    const res1 = await app.request("/test");
    const res2 = await app.request("/test");
    const res3 = await app.request("/test");

    // Assert
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });

  it("blocks requests over the limit with 429", async () => {
    // Arrange
    const app = createApp(2, 60_000);

    // Act
    await app.request("/test");
    await app.request("/test");
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(429);
    const body = await jsonBody<ErrorData>(res);
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("includes Retry-After header when rate limited", async () => {
    // Arrange
    const app = createApp(1, 60_000);

    // Act
    await app.request("/test");
    const res = await app.request("/test");

    // Assert
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
