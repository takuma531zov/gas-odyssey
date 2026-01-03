/**
 * 日付関連ユーティリティ
 * 日付操作、フォーマット変換など
 */

/**
 * 明日の日付を取得（YYYY/MM/DD形式）
 * スプレッドシートのPOSTING_DATE_COLUMNと比較するため
 */
export const getTomorrow = (): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
};

/**
 * 明日の指定時刻のISO 8601形式の文字列を取得
 * microCMSの予約公開時刻として使用
 * @param hour 時（0-23）デフォルト: 4
 * @param minute 分（0-59）デフォルト: 0
 */
export const getTomorrowAtTime = (hour = 4, minute = 0): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hour, minute, 0, 0);

  // ISO 8601形式（UTC）
  // microCMSはUTC形式を期待している可能性が高い
  // 例: 2026-01-03T19:00:00.000Z（JST 2026-01-04 04:00）
  return tomorrow.toISOString();
};

/**
 * 日付文字列をYYYY/MM/DD形式に変換
 * スプレッドシートの日付値（Date型）を文字列に変換
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
};
