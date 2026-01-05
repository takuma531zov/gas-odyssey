/**
 * 日付関連ユーティリティ
 * 日付操作、フォーマット変換など
 * すべての日付計算はAsia/Tokyoタイムゾーンで実行
 */

/** アジア/東京タイムゾーン定数 */
const TZ = "Asia/Tokyo";

/**
 * 明日の日付を取得（YYYY/MM/DD形式）
 * スプレッドシートのPOSTING_DATE_COLUMNと比較するため
 * Asia/Tokyoタイムゾーンで計算
 */
export const getTomorrow = (): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Utilities.formatDate(tomorrow, TZ, "yyyy/MM/dd");
};

/**
 * 日付文字列をYYYY/MM/DD形式に変換
 * スプレッドシートの日付値（Date型）を文字列に変換
 * Asia/Tokyoタイムゾーンで変換
 * @param date 変換する日付（Date型または日付文字列）
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;

  return Utilities.formatDate(d, TZ, "yyyy/MM/dd");
};
