/**
 * 関数合成ユーティリティ
 * 関数型プログラミングの基本的な合成関数を提供
 */

// パイプ処理用の型定義
type UnaryFunction<T, R> = (arg: T) => R;

/**
 * パイプ関数：左から右への関数合成
 */
export const pipe = <T, R>(...fns: UnaryFunction<unknown, unknown>[]) =>
  (value: T): R =>
    fns.reduce((acc, fn) => fn(acc), value as unknown) as R;

/**
 * 合成関数：右から左への関数合成
 */
export const compose = <T, R>(...fns: UnaryFunction<unknown, unknown>[]) =>
  (value: T): R =>
    fns.reduceRight((acc, fn) => fn(acc), value as unknown) as R;

/**
 * Maybe モナド：null/undefined セーフな処理
 */
export const maybe = <T, R>(fn: (value: T) => R) =>
  (value: T | null | undefined): R | null =>
    value != null ? fn(value) : null;

/**
 * Either モナド：エラーハンドリング
 */
export const either = <T, R>(
  onSuccess: (value: T) => R,
  onError: (error: Error | unknown) => R
) =>
  (value: T | Error): R => {
    if (value instanceof Error) {
      return onError(value);
    }
    try {
      return onSuccess(value);
    } catch (error) {
      return onError(error);
    }
  };

/**
 * orElse：失敗時のフォールバック処理
 */
export const orElse = <T>(fallback: () => T) =>
  (value: T | null | undefined): T =>
    value != null ? value : fallback();

/**
 * tap：副作用実行（デバッグ等）
 */
export const tap = <T>(fn: (value: T) => void) =>
  (value: T): T => {
    fn(value);
    return value;
  };

/**
 * filter：条件に基づくフィルタリング
 */
export const filter = <T>(predicate: (value: T) => boolean) =>
  (value: T): T | null =>
    predicate(value) ? value : null;

/**
 * map：値の変換（配列用）
 */
export const map = <T, R>(fn: (value: T) => R) =>
  (values: T[]): R[] =>
    values.map(fn);

/**
 * reduce：値の集約（配列用）
 */
export const reduce = <T, R>(fn: (acc: R, value: T) => R, initial: R) =>
  (values: T[]): R =>
    values.reduce(fn, initial);