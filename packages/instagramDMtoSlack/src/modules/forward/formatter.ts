// メッセージ整形モジュール
// Slack通知メッセージの整形とタイムスタンプのフォーマット、Block Kit対応

import type { InstagramUserInfo, InstagramAttachment } from "../../types";
import type { ProcessedMedia } from "../media/types";

/** Slack Block Kitのブロック型 */
export interface SlackBlock {
	type: string;
	text?: {
		type: string;
		text: string;
	};
	image_url?: string;
	alt_text?: string;
	elements?: SlackBlock[];
	accessory?: {
		type: string;
		image_url?: string;
		alt_text?: string;
	};
}

/** Slackメッセージペイロード */
export interface SlackPayload {
	text: string;
	blocks?: SlackBlock[];
}

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
 * Slack通知メッセージを整形（テキストのみ、後方互換用）
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

	return `*Instagram DM受信*

*送信者:* ${userInfo.name} (@${userInfo.username})
*送信者ID:* ${userInfo.id}
*時刻:* ${formattedTime}
*メッセージ:*
${messageText}`;
};

/**
 * Slack Block Kit形式のペイロードを生成
 * 画像がある場合は画像ブロックを追加
 * @param userInfo ユーザー情報
 * @param messageText メッセージテキスト（undefined可）
 * @param timestamp UNIXミリ秒
 * @param processedMedia 処理済みメディア（Google Drive URL付き）
 * @returns SlackペイロードJSON
 */
export const formatSlackPayload = (
	userInfo: InstagramUserInfo,
	messageText: string | undefined,
	timestamp: number,
	processedMedia?: ProcessedMedia[],
): SlackPayload => {
	const formattedTime = formatTimestamp(timestamp);

	// フォールバックテキスト（Slack API conversations.repliesで返却されるため送信者IDを含める）
	const messageLabel = messageText ?? "[メディアファイル]";
	const fallbackText = `*Instagram DM受信*\n*送信者:* ${userInfo.name} (@${userInfo.username})\n*送信者ID:* ${userInfo.id}\n*時刻:* ${formattedTime}\n*メッセージ:*\n${messageLabel}`;

	// ヘッダー部分
	const headerText = `*Instagram DM受信*

*送信者:* ${userInfo.name} (@${userInfo.username})
*送信者ID:* ${userInfo.id}
*時刻:* ${formattedTime}`;

	const blocks: SlackBlock[] = [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: headerText,
			},
		},
	];

	// メッセージテキストがある場合
	if (messageText) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*メッセージ:*\n${messageText}`,
			},
		});
	}

	// 画像/動画がある場合
	if (processedMedia && processedMedia.length > 0) {
		for (const media of processedMedia) {
			if (media.type === "image") {
				// 画像はimageブロックで表示
				blocks.push({
					type: "image",
					image_url: media.driveUrl,
					alt_text: "Instagram DM画像",
				});
			} else {
				// 動画/音声はリンクとして表示
				const mediaTypeLabel = media.type === "video" ? "動画" : "音声";
				blocks.push({
					type: "section",
					text: {
						type: "mrkdwn",
						text: `*添付${mediaTypeLabel}:* <${media.driveUrl}|ダウンロード>`,
					},
				});
			}
		}
	}

	return {
		text: fallbackText,
		blocks,
	};
};

/**
 * メディアタイプに応じたラベルを取得
 * @param type メディアタイプ
 * @returns 日本語ラベル
 */
export const getMediaTypeLabel = (type: string): string => {
	const labels: Record<string, string> = {
		image: "画像",
		video: "動画",
		audio: "音声",
	};
	return labels[type] ?? "ファイル";
};
