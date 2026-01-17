// リクエストルーティングモジュール
// POSTリクエストの種別を判定して適切なハンドラに振り分け

import type { RequestType } from "./types";

type ParsedPayload = Record<string, unknown>;

/**
 * リクエストペイロードの種別を判定
 * @param payload リクエストボディ（JSON文字列）
 * @returns リクエスト種別
 */
export const detectRequestType = (payload: string): RequestType => {
	try {
		const parsed: ParsedPayload = JSON.parse(payload);

		// Slack URL検証（type: url_verification）
		if (isSlackUrlVerification(parsed)) {
			return "slack_url_verification";
		}

		// Slack Event（type: event_callback）
		if (isSlackEvent(parsed)) {
			return "slack_event";
		}

		// Instagram Webhook（entry配列が存在）
		if (isInstagramWebhook(parsed)) {
			return "instagram_webhook";
		}

		return "unknown";
	} catch {
		return "unknown";
	}
};

/**
 * Slack URL検証リクエストかどうかを判定
 */
const isSlackUrlVerification = (parsed: ParsedPayload): boolean => {
	return parsed.type === "url_verification" && typeof parsed.challenge === "string";
};

/**
 * Slack Eventリクエストかどうかを判定
 */
const isSlackEvent = (parsed: ParsedPayload): boolean => {
	return parsed.type === "event_callback" && typeof parsed.event === "object";
};

/**
 * Instagram Webhookリクエストかどうかを判定
 */
const isInstagramWebhook = (parsed: ParsedPayload): boolean => {
	return Array.isArray(parsed.entry);
};
