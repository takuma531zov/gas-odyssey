// Instagram Webhook解析モジュール
// Webhookペイロードの解析とエコー・既読イベントのスキップ判定、添付ファイル抽出

import type {
	InstagramWebhookPayload,
	ParsedMessage,
} from "../../types";

/**
 * Instagram Webhookペイロードを解析
 * テキストまたは添付ファイル（画像/動画）のいずれかがあれば成功
 * @param payload JSON文字列
 * @returns 成功時はParsedMessage、スキップまたは失敗時はエラー
 */
export const parseWebhook = (
	payload: string,
):
	| { success: true; data: ParsedMessage }
	| { success: false; error: string; reason?: "skip" | "error" } => {
	try {
		// JSONパース
		const data: InstagramWebhookPayload = JSON.parse(payload);

		// entry配列を取得
		const entries = data?.entry;
		if (!entries || entries.length === 0) {
			return {
				success: false,
				error: "No entries in webhook",
				reason: "error",
			};
		}

		// 最初のentryからmessaging配列を取得
		const messaging = entries[0]?.messaging;
		if (!messaging || messaging.length === 0) {
			return {
				success: false,
				error: "No messaging data",
				reason: "error",
			};
		}

		// 最初のメッセージを取得
		const msg = messaging[0];

		// readイベント（既読）はスキップ
		if (msg.read) {
			return {
				success: false,
				error: "Read event (skip)",
				reason: "skip",
			};
		}

		// messageがない場合はスキップ
		const message = msg.message;
		if (!message) {
			return {
				success: false,
				error: "No message field",
				reason: "error",
			};
		}

		// is_echo: true（自分の送信）はスキップ
		if (message.is_echo) {
			return {
				success: false,
				error: "Echo message (skip)",
				reason: "skip",
			};
		}

		// メッセージ情報を抽出
		const senderId = msg.sender?.id;
		const messageText = message.text;
		const timestamp = msg.timestamp;
		const attachments = message.attachments;

		// senderId と timestamp は必須
		if (!senderId || !timestamp) {
			return {
				success: false,
				error: "Missing required fields (senderId or timestamp)",
				reason: "error",
			};
		}

		// テキストも添付ファイルもない場合はエラー
		if (!messageText && (!attachments || attachments.length === 0)) {
			return {
				success: false,
				error: "No text or attachments in message",
				reason: "error",
			};
		}

		return {
			success: true,
			data: {
				senderId,
				messageText,
				timestamp,
				attachments,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
			reason: "error",
		};
	}
};
