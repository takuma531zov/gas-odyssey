/**
 * 型定義
 * 全体で使用する型を一元管理
 */

/**
 * スプレッドシートから取得した記事情報
 */
export type Article = {
  rowIndex: number; // スプレッドシートの行番号（ステータス更新用）
  title: string; // 記事タイトル（ARTICLE_TITLE_COLUMN）
  author: string; // 著者名（AUTHOR_COLUMN）
  postingDate: string; // 投稿予定日（POSTING_DATE_COLUMN）
};

/**
 * フロントマターの型
 */
export type FrontMatter = {
  title: string; // 記事タイトル（必須）
  author: string; // 著者名（必須）
  tags: string[]; // タグ配列（オプション、デフォルト: []）
  read_time: string; // 読了時間（オプション、デフォルト: "3分"）
  status: string; // ステータス
  excerpt?: string; // 記事概要（オプション）
};

/**
 * パース済みマークダウン
 */
export type ParsedMarkdown = {
  frontMatter: FrontMatter; // フロントマター
  content: string; // コンテンツ（フロントマター除外後）
};

/**
 * GitHubから取得したファイル情報
 */
export type GitHubFile = {
  name: string; // ファイル名
  path: string; // ファイルパス
  sha: string; // SHA
  size: number; // ファイルサイズ
  url: string; // API URL
  html_url: string; // HTML URL
  git_url: string; // Git URL
  download_url: string; // ダウンロードURL
  type: string; // タイプ（file, dir等）
  content?: string; // Base64エンコードされたコンテンツ
  encoding?: string; // エンコーディング（base64等）
};

/**
 * 画像ファイル情報
 */
export type ImageFile = {
  filename: string; // ファイル名
  blob: GoogleAppsScript.Base.Blob; // Blobオブジェクト
};

/**
 * 画像URLマッピング
 */
export type ImageUrlMap = {
  [filename: string]: string; // ファイル名 → microCMS画像URL
};

/**
 * microCMS 著者情報
 */
export type MicroCMSAuthor = {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  revisedAt: string;
  member_name: string;
  member_icon?: {
    url: string;
    height: number;
    width: number;
  };
  member_description?: string;
  member_position?: string[];
  github_link?: string;
};

/**
 * microCMS タグ情報
 */
export type MicroCMSTag = {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  revisedAt?: string;
  slug: string; // タグID（例: "instagram"）
  tag_name: string; // タグ表示名（例: "Instagram"）
};

/**
 * microCMS API レスポンス（リスト取得）
 */
export type MicroCMSListResponse<T> = {
  contents: T[];
  totalCount: number;
  offset: number;
  limit: number;
};

/**
 * microCMS 画像アップロードレスポンス
 */
export type MicroCMSMediaResponse = {
  url: string;
  width?: number;
  height?: number;
};

/**
 * microCMS 記事投稿リクエストボディ
 */
export type MicroCMSBlogPostRequest = {
  title: string;
  author: string; // 著者ID
  content: string; // HTML変換済みコンテンツ
  tag: string[]; // タグID配列
  read_time: string[]; // 読了時間配列（例: ["3分"]）
  excerpt?: string; // 記事概要（オプション）
  status: "DRAFT" | "PUBLISH";
  publishedAt: string; // ISO 8601形式の日時
};

/**
 * Dify通知リクエストボディ（後で実装）
 */
export type DifyNotifyRequest = {
  article: Record<string, unknown>; // 取得したマークダウンタイトル
  article_item: Record<string, unknown>; // ARTICLE_TITLE_COLUMNの値（github取得失敗時用）
  success: boolean; // 論理的成功フラグ
  error: string; // エラーメッセージ
  status_code: number; // HTTPステータス
  response_body: string; // HTTPレスポンス
};
