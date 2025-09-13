/**
 * 関数合成ユーティリティ
 * 関数型プログラミングの基本的な合成関数を提供
 */

// パイプ処理用の型定義
type UnaryFunction<T, R> = (arg: T) => R;

/**
 * パイプ関数：左から右への関数合成
 */
export function pipe<A, B>(fn1: (a: A) => B): (a: A) => B;
export function pipe<A, B, C>(fn1: (a: A) => B, fn2: (b: B) => C): (a: A) => C;
export function pipe<A, B, C, D>(
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
): (a: A) => D;
export function pipe<A, B, C, D, E>(
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
  fn4: (d: D) => E,
): (a: A) => E;
export function pipe<A, B, C, D, E, F>(
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
  fn4: (d: D) => E,
  fn5: (e: E) => F,
): (a: A) => F;
export function pipe(
  ...fns: Array<UnaryFunction<unknown, unknown>>
): UnaryFunction<unknown, unknown> {
  return (value: unknown) => fns.reduce((acc, fn) => fn(acc), value);
}
