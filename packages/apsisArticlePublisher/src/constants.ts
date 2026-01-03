/**
 * 定数定義
 * エンドポイント名などのハードコーディングを回避し、一元管理する
 */

/**
 * microCMSのエンドポイント名
 */
export const MICROCMS_ENDPOINTS = {
  BLOGS: "blogs", // 記事投稿先
  PROFILE: "profile", // 著者マスタ
  TAGS: "tags", // タグマスタ
} as const;

/**
 * スプレッドシートのステータス値
 */
export const SHEET_STATUS = {
  READY: "投稿準備完了", // 投稿準備完了
  POSTED: "投稿済み", // 投稿成功
  FAILED: "投稿失敗", // 投稿失敗
} as const;

/**
 * プラットフォーム名
 */
export const PLATFORM = {
  APSIS: "Apsis",
} as const;
