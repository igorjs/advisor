// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { describe, expect, it } from "vitest";
import { toConversationResponse, toVisibleMessages } from "../dto/conversation.dto.js";

describe("toConversationResponse", () => {
  it("maps a conversation row to the API response shape", () => {
    // Arrange
    const row = {
      id: 1,
      publicId: "abc-123",
      userId: null,
      title: "Tax advice",
      deletedAt: null,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-01-01 00:00:00",
    };

    // Act
    const result = toConversationResponse(row);

    // Assert
    expect(result).toEqual({
      publicId: "abc-123",
      title: "Tax advice",
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-01-01 00:00:00",
    });
  });

  it("excludes internal fields (id, userId, deletedAt)", () => {
    // Arrange
    const row = {
      id: 42,
      publicId: "x",
      userId: "user-1",
      title: "t",
      deletedAt: "2026-06-01",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };

    // Act
    const result = toConversationResponse(row);

    // Assert
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("deletedAt");
  });
});

describe("toVisibleMessages", () => {
  const baseMessage = {
    id: 1,
    publicId: "msg-1",
    conversationId: 1,
    version: 1,
    toolCalls: null,
    toolCallId: null,
    createdAt: "2026-01-01 00:00:00",
  };

  it("includes user messages", () => {
    // Arrange
    const rows = [{ ...baseMessage, role: "user", content: "Hello" }];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toEqual([{ publicId: "msg-1", role: "user", content: "Hello" }]);
  });

  it("includes assistant text messages (no tool calls)", () => {
    // Arrange
    const rows = [
      { ...baseMessage, role: "assistant", content: "How can I help?" },
    ];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toEqual([{ publicId: "msg-1", role: "assistant", content: "How can I help?" }]);
  });

  it("excludes assistant messages with tool calls", () => {
    // Arrange: assistant message that requested a tool call (no user-visible content)
    const rows = [
      {
        ...baseMessage,
        role: "assistant",
        content: "",
        toolCalls:
          "[{\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"web_search\",\"arguments\":\"{}\"}}]",
      },
    ];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toHaveLength(0);
  });

  it("excludes assistant messages with tool calls even if they have content", () => {
    // Arrange: some models include a text preamble alongside tool calls
    const rows = [
      { ...baseMessage, role: "assistant", content: "Let me search for that.", toolCalls: "[{\"id\":\"call_1\"}]" },
    ];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toHaveLength(0);
  });

  it("excludes tool result messages", () => {
    // Arrange: raw search results from Jina, not meant for display
    const rows = [
      { ...baseMessage, role: "tool", content: "[{\"title\":\"ATO\",\"url\":\"...\"}]", toolCallId: "call_1" },
    ];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toHaveLength(0);
  });

  it("excludes assistant messages with empty content and no tool calls", () => {
    // Arrange
    const rows = [{ ...baseMessage, role: "assistant", content: "" }];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toHaveLength(0);
  });

  it("preserves message order", () => {
    // Arrange
    const rows = [
      { ...baseMessage, id: 1, publicId: "m1", role: "user", content: "Question" },
      { ...baseMessage, id: 2, publicId: "m2", role: "assistant", content: "", toolCalls: "[{}]" },
      { ...baseMessage, id: 3, publicId: "m3", role: "tool", content: "results", toolCallId: "c1" },
      { ...baseMessage, id: 4, publicId: "m4", role: "assistant", content: "Here is my answer." },
      { ...baseMessage, id: 5, publicId: "m5", role: "user", content: "Thanks" },
    ];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toEqual([
      { publicId: "m1", role: "user", content: "Question" },
      { publicId: "m4", role: "assistant", content: "Here is my answer." },
      { publicId: "m5", role: "user", content: "Thanks" },
    ]);
  });

  it("returns empty array for empty input", () => {
    // Act
    const result = toVisibleMessages([]);

    // Assert
    expect(result).toEqual([]);
  });

  it("handles a full multi-turn conversation", () => {
    // Arrange: realistic conversation with tool calls interleaved
    const rows = [
      { ...baseMessage, id: 1, publicId: "m1", role: "user", content: "Tax advice for $200k income in Sydney" },
      { ...baseMessage, id: 2, publicId: "m2", role: "assistant", content: "Do you have investments?" },
      { ...baseMessage, id: 3, publicId: "m3", role: "user", content: "Yes, shares and property" },
      { ...baseMessage, id: 4, publicId: "m4", role: "assistant", content: "", toolCalls: "[{\"id\":\"c1\"}]" },
      { ...baseMessage, id: 5, publicId: "m5", role: "tool", content: "search results", toolCallId: "c1" },
      {
        ...baseMessage,
        id: 6,
        publicId: "m6",
        role: "assistant",
        content: "{\"records\":[{\"title\":\"A\",\"description\":\"B\"}]}",
      },
    ];

    // Act
    const result = toVisibleMessages(rows);

    // Assert
    expect(result).toHaveLength(4);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });
});
