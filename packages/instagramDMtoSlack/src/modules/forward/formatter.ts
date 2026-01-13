// メッセージ整形モジュール
// Slack通知メッセージの整形とタイムスタンプのフォーマット

import type { InstagramUserInfo } from "../../types";

/**
 * タイムスタンプをJST日時文字列に変換
 * @param timestamp UNIXミリ秒
 * @returns yyyy-MM-dd HH:mm:ss形式の日時文字列
 */
export const formatTimestamp = (timestamp: number): string => {
	try {
		// UNIXミリ秒を秒に変換してDate作成
		const date = new Date(timestamp);
		return Utilities.formatDate(date, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
	} catch (error) {
		return String(timestamp);
	}
};

/**
 * Slack通知メッセージを整形
 * @param userInfo ユーザー情報
 * @param messageText メッセージテキスト
 * @param timestamp UNIXミリ秒
 * @returns 整形されたSlackメッセージ
 */
export const formatSlackMessage = (
	userInfo: InstagramUserInfo,
	messageText: string,
	timestamp: number,
): string => {
	const formattedTime = formatTimestamp(timestamp);

	return `📩 *Instagram DM受信*

*送信者:* ${userInfo.name} (@${userInfo.username})
*送信者ID:* ${userInfo.id}
*時刻:* ${formattedTime}
*メッセージ:*
${messageText}`;
};
