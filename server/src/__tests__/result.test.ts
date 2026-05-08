import { describe, expect, it } from "vitest";
import {
  Err,
  fromNullable,
  None,
  Ok,
  pipe,
  type Result,
  Some,
  tryCatch,
} from "../lib/result.js";

describe("Result", () => {
  describe("Ok", () => {
    it("wraps a value and reports ok: true", () => {
      // Arrange & Act
      const result = Ok(42);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it("maps over the value", () => {
      // Arrange & Act
      const result = Ok(10).map((n) => n * 2);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.value).toBe(20);
    });

    it("flatMaps into another Result", () => {
      // Arrange
      const validate = (n: number): Result<number, string> =>
        n > 0 ? Ok(n * 3) : Err("must be positive");

      // Act
      const result = Ok<number, string>(5).flatMap(validate);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.value).toBe(15);
    });

    it("unwraps the value", () => {
      // Arrange & Act & Assert
      expect(Ok("hello").unwrap()).toBe("hello");
    });

    it("unwrapOr returns the value, not the fallback", () => {
      // Arrange & Act & Assert
      expect(Ok(42).unwrapOr(0)).toBe(42);
    });

    it("matches the ok branch", () => {
      // Arrange & Act
      const message = Ok(10).match({
        ok: (v) => `got ${v}`,
        err: (e) => `failed: ${e}`,
      });

      // Assert
      expect(message).toBe("got 10");
    });
  });

  describe("Err", () => {
    it("wraps an error and reports ok: false", () => {
      // Arrange & Act
      const result = Err("something went wrong");

      // Assert
      expect(result.ok).toBe(false);
      expect(result.error).toBe("something went wrong");
    });

    it("map is a no-op and preserves the error", () => {
      // Arrange
      const original = Err<number, string>("fail");

      // Act
      const mapped = original.map((n) => n * 2);

      // Assert
      expect(mapped.ok).toBe(false);
      expect(mapped.error).toBe("fail");
    });

    it("flatMap is a no-op and preserves the error", () => {
      // Arrange
      const original = Err<number, string>("fail");

      // Act
      const mapped = original.flatMap((n) => Ok(n * 2));

      // Assert
      expect(mapped.ok).toBe(false);
      expect(mapped.error).toBe("fail");
    });

    it("unwrap throws", () => {
      // Arrange & Act & Assert
      expect(() => Err("boom").unwrap()).toThrow("boom");
    });

    it("unwrapOr returns the fallback", () => {
      // Arrange & Act & Assert
      expect(Err<number, string>("fail").unwrapOr(99)).toBe(99);
    });

    it("matches the err branch", () => {
      // Arrange & Act
      const message = Err("oops").match({
        ok: (v) => `got ${v}`,
        err: (e) => `failed: ${e}`,
      });

      // Assert
      expect(message).toBe("failed: oops");
    });
  });

  describe("flatMap short-circuits on first error", () => {
    it("stops at the first Err in a chain", () => {
      // Arrange & Act
      const result = Ok<number, string>(10)
        .flatMap((n) => Ok(n + 5))
        .flatMap(() => Err("broke here"))
        .flatMap((n) => Ok(n * 100));

      // Assert
      expect(result.ok).toBe(false);
      expect(result.error).toBe("broke here");
    });
  });
});

describe("Option", () => {
  describe("Some", () => {
    it("wraps a value and reports some: true", () => {
      // Arrange & Act
      const option = Some(42);

      // Assert
      expect(option.some).toBe(true);
      expect(option.value).toBe(42);
    });

    it("maps over the value", () => {
      // Arrange & Act
      const option = Some("hello").map((s) => s.toUpperCase());

      // Assert
      expect(option.some).toBe(true);
      expect(option.value).toBe("HELLO");
    });

    it("flatMaps into another Option", () => {
      // Arrange
      const validate = (n: number) => (n > 0 ? Some(n * 2) : None<number>());

      // Act
      const option = Some(5).flatMap(validate);

      // Assert
      expect(option.some).toBe(true);
      expect(option.value).toBe(10);
    });

    it("unwraps the value", () => {
      // Arrange & Act & Assert
      expect(Some("test").unwrap()).toBe("test");
    });

    it("unwrapOr returns the value, not the fallback", () => {
      // Arrange & Act & Assert
      expect(Some(42).unwrapOr(0)).toBe(42);
    });

    it("matches the some branch", () => {
      // Arrange & Act
      const msg = Some(5).match({
        some: (v) => `found ${v}`,
        none: () => "empty",
      });

      // Assert
      expect(msg).toBe("found 5");
    });

    it("converts to Ok result", () => {
      // Arrange & Act
      const result = Some(42).toResult("was none");

      // Assert
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });
  });

  describe("None", () => {
    it("reports some: false", () => {
      // Arrange & Act & Assert
      expect(None().some).toBe(false);
    });

    it("map is a no-op", () => {
      // Arrange & Act
      const option = None<number>().map((n) => n * 2);

      // Assert
      expect(option.some).toBe(false);
    });

    it("flatMap is a no-op", () => {
      // Arrange & Act
      const option = None<number>().flatMap((n) => Some(n * 2));

      // Assert
      expect(option.some).toBe(false);
    });

    it("unwrap throws", () => {
      // Arrange & Act & Assert
      expect(() => None().unwrap()).toThrow("unwrap called on None");
    });

    it("unwrapOr returns the fallback", () => {
      // Arrange & Act & Assert
      expect(None<number>().unwrapOr(99)).toBe(99);
    });

    it("matches the none branch", () => {
      // Arrange & Act
      const msg = None().match({
        some: (v) => `found ${v}`,
        none: () => "empty",
      });

      // Assert
      expect(msg).toBe("empty");
    });

    it("converts to Err result", () => {
      // Arrange & Act
      const result = None().toResult("missing");

      // Assert
      expect(result.ok).toBe(false);
      expect(result.error).toBe("missing");
    });
  });

  describe("fromNullable", () => {
    it("returns Some for a non-null value", () => {
      // Arrange & Act
      const option = fromNullable(42);

      // Assert
      expect(option.some).toBe(true);
      if (option.some) expect(option.value).toBe(42);
    });

    it("returns None for null", () => {
      // Arrange & Act & Assert
      expect(fromNullable(null).some).toBe(false);
    });
  });
});

describe("pipe", () => {
  it("returns the value when called with no functions", () => {
    // Arrange & Act & Assert
    expect(pipe(42)).toBe(42);
  });

  it("applies a single function", () => {
    // Arrange & Act
    const result = pipe(
      5,
      (n) => n * 2,
    );

    // Assert
    expect(result).toBe(10);
  });

  it("composes multiple functions left to right", () => {
    // Arrange & Act
    const result = pipe(
      "hello",
      (s) => s.toUpperCase(),
      (s) => s + "!",
      (s) => s.length,
    );

    // Assert
    expect(result).toBe(6);
  });

  it("works with Result transformations", () => {
    // Arrange & Act
    const result = pipe(
      Ok(10),
      (r) => r.map((n) => n * 2),
      (r) => r.map((n) => n + 1),
    );

    // Assert
    expect(result.ok).toBe(true);
    expect(result.value).toBe(21);
  });

  it("works with Option transformations", () => {
    // Arrange & Act
    const result = pipe(
      Some("hello"),
      (o) => o.map((s) => s.toUpperCase()),
      (o) => o.unwrapOr("default"),
    );

    // Assert
    expect(result).toBe("HELLO");
  });
});

describe("tryCatch", () => {
  it("returns Ok when the function succeeds", () => {
    // Arrange & Act
    const result = tryCatch(
      () => JSON.parse('{"a":1}'),
      (e) => e.message,
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it("returns Err when the function throws", () => {
    // Arrange & Act
    const result = tryCatch(
      () => JSON.parse("not json"),
      (e) => e.message,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unexpected token");
  });

  it("handles async functions", async () => {
    // Arrange & Act
    const result = await tryCatch(
      async () => "async value",
      (e) => e.message,
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("async value");
  });

  it("catches async rejections", async () => {
    // Arrange & Act
    const result = await tryCatch(
      async () => {
        throw new Error("async boom");
      },
      (e) => e.message,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("async boom");
  });
});
