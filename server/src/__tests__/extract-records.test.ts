// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { describe, expect, it } from "vitest";
import { extractRecords } from "../lib/extract-records.js";

describe("extractRecords", () => {
  const validRecords = {
    records: [
      { title: "Strategy A", description: "Do A" },
      { title: "Strategy B", description: "Do B" },
    ],
  };

  it("parses clean JSON", () => {
    // Arrange
    const input = JSON.stringify(validRecords);

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual(validRecords);
  });

  it("parses JSON wrapped in code fences", () => {
    // Arrange
    const input = "```json\n" + JSON.stringify(validRecords) + "\n```";

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual(validRecords);
  });

  it("parses JSON wrapped in plain code fences", () => {
    // Arrange
    const input = "```\n" + JSON.stringify(validRecords) + "\n```";

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual(validRecords);
  });

  it("extracts JSON from preamble text", () => {
    // Arrange
    const input = "Here are the strategies:\n" + JSON.stringify(validRecords);

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual(validRecords);
  });

  it("extracts JSON from postamble text", () => {
    // Arrange
    const input = JSON.stringify(validRecords) + "\n\nLet me know if you need more info.";

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual(validRecords);
  });

  it("extracts JSON surrounded by preamble and postamble", () => {
    // Arrange
    const input = "Based on my research:\n" + JSON.stringify(validRecords) + "\nHope this helps!";

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual(validRecords);
  });

  it("returns null for plain text with no JSON", () => {
    // Act
    const result = extractRecords("Here are some tips for tax planning.");

    // Assert
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    // Act
    const result = extractRecords("");

    // Assert
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON structure", () => {
    // Arrange: valid JSON but wrong shape (missing records array)
    const input = JSON.stringify({ strategies: [{ name: "A" }] });

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toBeNull();
  });

  it("returns null for records with missing fields", () => {
    // Arrange: records array but items missing description
    const input = JSON.stringify({ records: [{ title: "A" }] });

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    // Arrange
    const input = '{"records": [{"title": "A", "description":}]}';

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toBeNull();
  });

  it("handles JSON with only opening brace", () => {
    // Arrange
    const input = "Here is a { partial response";

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toBeNull();
  });

  it("parses pretty-printed JSON", () => {
    // Arrange
    const input = JSON.stringify(validRecords, null, 2);

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual(validRecords);
  });

  it("handles empty records array", () => {
    // Arrange
    const input = JSON.stringify({ records: [] });

    // Act
    const result = extractRecords(input);

    // Assert
    expect(result).toEqual({ records: [] });
  });
});
