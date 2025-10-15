// 送信媒体の型
export type MessagePlatform = "Gmail" | "LINE" | "GoogleChat";

// 代理店情報の型
export type Agency = {
  companyName: string; // A列: 会社名
  personInCharge?: string; // B列: 担当者名（任意）
  templateName: string; // C列: 使用テンプレ
  platform: MessagePlatform; // D列: 送信媒体
  roomId?: string; // E列: ルームID（任意）
  toAddresses: string[]; // F列: TOアドレス（,区切り）
  ccAddresses?: string[]; // G列: CCアドレス（,区切り、任意）
  sendDays: string[]; // H列: 送信日（曜日,区切り）
};

// テンプレート情報の型
export type Template = {
  subject: string; // 件名
  body: string; // 本文
};

// テンプレート変数の型
export type TemplateVariables = {
  companyName: string; // 会社名
  personInCharge?: string; // 担当者名（任意）
};

// ファイル差分情報の型
export type FileDiff = {
  rowNumber: number; // 行番号
  value: string; // MAIL_BODY_SOURCE_COLUMN列の値
  changeType: "new" | "updated"; // 変更種別（新規追加 or 更新）
  changedColumnNames?: string[]; // 変更列のヘッダー名（更新時のみ）
};

// 送信結果の型
export type SendResult = {
  success: boolean; // 成功/失敗
  agency: Agency; // 代理店情報
  timestamp: Date; // 送信日時
  errorMessage?: string; // エラーメッセージ（失敗時）
  attachmentFileId?: string; // 添付ファイルID
  diffSummary?: string; // 差分サマリー
};

// 添付ファイル情報の型
export type AttachmentFile = {
  file: GoogleAppsScript.Drive.File; // ファイルオブジェクト
  url: string; // ファイルURL
  diffs: FileDiff[]; // 差分情報
};
