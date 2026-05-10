// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { describe, expect, it } from "vitest";
import { Err, Ok } from "../lib/result.js";
import type { LlmService } from "../services/llm.service.js";

/**
 * The LlmService interface contract. Rather than mocking OpenAI internals,
 * we verify the contract through a mock implementation used in service tests.
 * The actual OpenAI SDK integration is tested via manual/e2e testing.
 */

export function createMockLlmService(
  overrides?: Partial<LlmService>,
): LlmService {
  return {
    generateRecords: overrides?.generateRecords
      ?? (() =>
        Promise.resolve(
          Ok([
            { title: "Tip 1", description: "Do this first" },
            { title: "Tip 2", description: "Then do this" },
          ]),
        )),
  };
}

describe("LlmService contract", () => {
  it("mock returns Ok with records by default", async () => {
    // Arrange
    const llm = createMockLlmService();

    // Act
    const result = await llm.generateRecords("test prompt");

    // Assert
    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(2);
    expect(result.value[0]).toEqual({
      title: "Tip 1",
      description: "Do this first",
    });
  });

  it("mock can simulate LLM timeout", async () => {
    // Arrange
    const llm = createMockLlmService({
      generateRecords: () =>
        Promise.resolve(
          Err({ code: "LLM_TIMEOUT", message: "Request timed out" }),
        ),
    });

    // Act
    const result = await llm.generateRecords("test");

    // Assert
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("LLM_TIMEOUT");
  });

  it("mock can simulate parse error", async () => {
    // Arrange
    const llm = createMockLlmService({
      generateRecords: () =>
        Promise.resolve(
          Err({ code: "LLM_PARSE_ERROR", message: "Failed to parse" }),
        ),
    });

    // Act
    const result = await llm.generateRecords("test");

    // Assert
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("LLM_PARSE_ERROR");
  });
});
