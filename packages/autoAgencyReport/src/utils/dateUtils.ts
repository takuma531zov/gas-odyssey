import { WEEKDAY_MAP } from "../config/constants";

/**
 * 本日の曜日を日本語で取得
 * @returns 曜日（例: "月", "火", ...）
 */
export const getTodayWeekday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (日曜) から 6 (土曜)
  return WEEKDAY_MAP[dayOfWeek];
};

/**
 * 指定された曜日リストに本日の曜日が含まれるかチェック
 * @param sendDays 送信対象曜日の配列（例: ["月", "水", "金"]）
 * @returns 本日が送信対象の場合true
 */
export const isTodaySendDay = (sendDays: string[]): boolean => {
  const todayWeekday = getTodayWeekday();
  return sendDays.includes(todayWeekday);
};

/**
 * 日付を指定フォーマットで文字列化
 * @param date 対象の日付
 * @param format フォーマット（例: "yyyy-MM-dd HH:mm:ss"）
 * @returns フォーマットされた日付文字列
 */
export const formatDate = (date: Date, format: string): string => {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), format);
};
