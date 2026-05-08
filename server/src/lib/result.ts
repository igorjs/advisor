/**
 * Lightweight Result and Option types inspired by pure-fx.
 * Errors are values, not exceptions.
 */

// ---------------------------------------------------------------------------
// Result<T, E>
// ---------------------------------------------------------------------------

export interface Result<T, E> {
  readonly ok: boolean;
  readonly value: T;
  readonly error: E;
  map<U>(fn: (value: T) => U): Result<U, E>;
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  match<U>(matcher: { ok: (value: T) => U; err: (error: E) => U }): U;
}

export function Ok<T, E = never>(value: T): Result<T, E> {
  return {
    ok: true,
    value,
    error: undefined as never,
    map: <U>(fn: (value: T) => U) => Ok<U, E>(fn(value)),
    flatMap: <U>(fn: (value: T) => Result<U, E>) => fn(value),
    match: <U>(matcher: { ok: (value: T) => U; err: (error: E) => U }) =>
      matcher.ok(value),
  };
}

export function Err<T = never, E = string>(error: E): Result<T, E> {
  return {
    ok: false,
    value: undefined as never,
    error,
    map: <U>() => Err<U, E>(error),
    flatMap: <U>() => Err<U, E>(error),
    match: <U>(matcher: { ok: (value: T) => U; err: (error: E) => U }) =>
      matcher.err(error),
  };
}

// ---------------------------------------------------------------------------
// Option<T>
// ---------------------------------------------------------------------------

export interface Option<T> {
  readonly some: boolean;
  readonly value: T;
  map<U>(fn: (value: T) => U): Option<U>;
  flatMap<U>(fn: (value: T) => Option<U>): Option<U>;
  match<U>(matcher: { some: (value: T) => U; none: () => U }): U;
  toResult<E>(error: E): Result<T, E>;
}

export function Some<T>(value: T): Option<T> {
  return {
    some: true,
    value,
    map: <U>(fn: (value: T) => U) => Some(fn(value)),
    flatMap: <U>(fn: (value: T) => Option<U>) => fn(value),
    match: <U>(matcher: { some: (value: T) => U; none: () => U }) =>
      matcher.some(value),
    toResult: <E>() => Ok<T, E>(value),
  };
}

export function None<T = never>(): Option<T> {
  return {
    some: false,
    value: undefined as never,
    map: <U>() => None<U>(),
    flatMap: <U>() => None<U>(),
    match: <U>(matcher: { some: (value: T) => U; none: () => U }) =>
      matcher.none(),
    toResult: <E>(error: E) => Err<T, E>(error),
  };
}

/** Convert a nullable value to Option. null becomes None, non-null becomes Some. */
export function fromNullable<T>(value: T | null): Option<T> {
  return value !== null ? Some(value) : None();
}
