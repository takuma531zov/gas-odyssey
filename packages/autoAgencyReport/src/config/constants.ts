// 代理店リストの列インデックス（0始まり）
export const AGENCY_LIST_COLUMNS = {
  COMPANY_NAME: 0, // A列: 会社名
  PERSON_IN_CHARGE: 1, // B列: 担当者名
  TEMPLATE_NAME: 2, // C列: 使用テンプレ
  PLATFORM: 3, // D列: 送信媒体
  ROOM_ID: 4, // E列: ルームID
  TO_ADDRESSES: 5, // F列: TOアドレス
  CC_ADDRESSES: 6, // G列: CCアドレス
  SEND_DAYS: 7, // H列: 送信日
} as const;

// 曜日定義
export const WEEKDAYS = {
  SUNDAY: "日",
  MONDAY: "月",
  TUESDAY: "火",
  WEDNESDAY: "水",
  THURSDAY: "木",
  FRIDAY: "金",
  SATURDAY: "土",
} as const;

// 曜日番号から日本語曜日への変換マップ
export const WEEKDAY_MAP: Record<number, string> = {
  0: WEEKDAYS.SUNDAY,
  1: WEEKDAYS.MONDAY,
  2: WEEKDAYS.TUESDAY,
  3: WEEKDAYS.WEDNESDAY,
  4: WEEKDAYS.THURSDAY,
  5: WEEKDAYS.FRIDAY,
  6: WEEKDAYS.SATURDAY,
};

// テンプレート変数のパターン
export const TEMPLATE_VARIABLES = {
  COMPANY_NAME: "{{会社名}}",
  PERSON_IN_CHARGE: "{{担当者}}",
} as const;

// 送信済みフォルダの構成
export const SENT_FOLDER_NAME = "送信済みフォルダ";

// ログ出力時のフォーマット
export const LOG_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss";

// ヘッダー行番号
export const HEADER_ROW_NUMBER = 1;

// データ開始行番号
export const DATA_START_ROW_NUMBER = 2;
