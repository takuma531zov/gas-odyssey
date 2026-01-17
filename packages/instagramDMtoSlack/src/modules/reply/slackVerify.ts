// Slack URL検証モジュール
// Slack Event Subscriptions設定時のURL検証（challenge応答）

import { logInfo } from "../../../../common/src/logger";
import type { SlackUrlVerificationPayload } from "../../types";

type TextOutput = GoogleAppsScript.Content.TextOutput;

/**
 * Slack URL検証のchallengeに応答
 * @param payload リクエストペイロード（JSON文字列）
 * @returns challenge値を含むTextOutput
 */
export const handleChallenge = (payload: string): TextOutput => {
	const parsed: SlackUrlVerificationPayload = JSON.parse(payload);

	logInfo("Slack URL verification received", { challenge: parsed.challenge });

	return ContentService.createTextOutput(parsed.challenge).setMimeType(
		ContentService.MimeType.TEXT,
	);
};
