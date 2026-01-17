// index.ts は純粋なGASエントリーポイント: ロジックは呼び出しのみ
// 機能: Instagram Webhook / Slack Event の振り分けとハンドリング

import { logWarn } from "../../common/src/logger";
import { handleDoGet } from "./modules/verify";
import { handleDoPost as handleInstagramPost } from "./modules/forward";
import { handleSlackReply } from "./modules/reply";
import { handleChallenge } from "./modules/reply/slackVerify";
import { detectRequestType } from "./router";

type TextOutput = GoogleAppsScript.Content.TextOutput;

const json = (data: unknown): TextOutput =>
	ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
		ContentService.MimeType.JSON,
	);

/**
 * GETエンドポイント: Instagram Webhook 検証
 * - フロー: リクエスト受領 -> 検証ハンドラ呼び出し -> TextOutput返却
 */
function doGet(e: GoogleAppsScript.Events.DoGet) {
	return handleDoGet(e);
}

/**
 * POSTエンドポイント: Instagram DM / Slack Eventの振り分け
 * - Instagram Webhook -> forward処理（既存）
 * - Slack URL検証 -> challenge応答
 * - Slack Event -> reply処理（DM送信）
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
	const payload = e.postData.contents;
	const requestType = detectRequestType(payload);

	switch (requestType) {
		case "slack_url_verification":
			return handleChallenge(payload);

		case "slack_event":
			return handleSlackReply(e);

		case "instagram_webhook":
			return handleInstagramPost(e);

		default:
			logWarn("Unknown request type received", { payload: payload.slice(0, 200) });
			return json({ success: false, error: "Unknown request type" });
	}
}

// GASから呼び出せるようにグローバル関数として公開
declare const global: { [k: string]: unknown };
global.doGet = doGet;
global.doPost = doPost;
