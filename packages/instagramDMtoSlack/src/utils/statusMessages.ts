// ステータスメッセージ定義
// ログ出力用のステータス文字列マッピング

import type { ProcessStatus, ReplyStatus } from "../types";

// DM受信処理（forward）のステータスメッセージ
export const PROCESS_STATUS_MESSAGES: Record<ProcessStatus, string> = {
	success: "成功",
	skipped_echo: "スキップ（エコー）",
	skipped_read: "スキップ（既読）",
	error_parse: "エラー（解析失敗）",
	error_api: "エラー（API失敗）",
	error_slack: "エラー（Slack送信失敗）",
	error_log: "エラー（ログ出力失敗）",
};

// DM返信処理（reply）のステータスメッセージ
export const REPLY_STATUS_MESSAGES: Record<ReplyStatus, string> = {
	success: "成功",
	skipped_not_thread: "スキップ（スレッド返信でない）",
	skipped_bot_message: "スキップ（ボットメッセージ）",
	error_parse: "エラー（解析失敗）",
	error_slack_api: "エラー（Slack API失敗）",
	error_instagram_api: "エラー（Instagram API失敗）",
	error_log: "エラー（ログ出力失敗）",
};

/**
 * ProcessStatusを日本語ステータス文字列に変換
 */
export const formatProcessStatus = (status: ProcessStatus): string => {
	return PROCESS_STATUS_MESSAGES[status] ?? "不明";
};

/**
 * ReplyStatusを日本語ステータス文字列に変換
 */
export const formatReplyStatus = (status: ReplyStatus): string => {
	return REPLY_STATUS_MESSAGES[status] ?? "不明";
};
