// Slack返信 → Instagram DM送信のオーケストレーション
// Slackスレッド返信からInstagram DMへの転送処理フロー制御

import { logError, logInfo, logWarn } from "../../../../common/src/logger";
import { refreshToken } from "../../utils/tokenManager";
import type { ReplyResult, SlackEventPayload } from "../../types";
import { isDuplicateEvent, markEventAsProcessed } from "./dedup";
import { extractInstagramUserId, parseSlackEvent } from "./parser";
import { addReaction, getParentMessage } from "./slackApi";
import { sendInstagramDm } from "./instagram";
import { writeReplyLog } from "./sheetLogger";
import { sendErrorNotification } from "../forward/notifier";

const SUCCESS_EMOJI = "white_check_mark";

type TextOutput = GoogleAppsScript.Content.TextOutput;

const json = (data: unknown): TextOutput =>
	ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
		ContentService.MimeType.JSON,
	);

/**
 * Slackスレッド返信からInstagram DMを送信
 * @param e DoPostイベント
 * @returns TextOutput(JSON)
 */
export const handleSlackReply = (
	e: GoogleAppsScript.Events.DoPost,
): TextOutput => {
	try {
		const payload = e.postData.contents;
		logInfo("Slack reply event received");

		// 0. 重複検出（Slackリトライ対策）
		const parsedPayload: SlackEventPayload = JSON.parse(payload);
		const eventId = parsedPayload.event_id;

		if (isDuplicateEvent(eventId)) {
			return json({ success: true, message: "Duplicate event skipped" });
		}
		markEventAsProcessed(eventId);

		// 1. Slack Eventペイロード解析
		const parseResult = parseSlackEvent(payload);

		if (!parseResult.success) {
			// スキップケース（スレッド返信でない等）
			if (parseResult.reason === "skip") {
				logWarn("Slack event skipped", { reason: parseResult.error });
				return json({ success: true, message: "Event skipped" });
			}

			// 解析エラー
			logError("Slack event parse failed", parseResult.error);
			const errorResult: ReplyResult = {
				success: false,
				status: "error_parse",
				error: parseResult.error,
				details: parseResult.error,
			};
			sendErrorNotification("Slack返信解析失敗", parseResult.error ?? "Unknown error");
			writeReplyLog(errorResult);
			return json({ success: false, error: parseResult.error });
		}

		const { channel, threadTs, messageTs, replyText } = parseResult.data;

		// 2. Slack APIで親メッセージ取得
		const parentResult = getParentMessage(channel, threadTs);

		if (!parentResult.success) {
			logError("Failed to get parent message", parentResult.error);
			const errorResult: ReplyResult = {
				success: false,
				replyText,
				status: "error_slack_api",
				error: parentResult.error,
				details: parentResult.error,
			};
			sendErrorNotification("Slack親メッセージ取得失敗", parentResult.error ?? "Unknown error");
			writeReplyLog(errorResult);
			return json({ success: false, error: parentResult.error });
		}

		// 3. 親メッセージからInstagram送信者IDを抽出
		const instagramUserId = extractInstagramUserId(parentResult.data.text);

		if (!instagramUserId) {
			logWarn("Instagram user ID not found in parent message");
			const errorResult: ReplyResult = {
				success: false,
				replyText,
				status: "error_parse",
				error: "Instagram user ID not found in parent message",
				details: "Could not extract Instagram user ID from thread parent",
			};
			sendErrorNotification("Instagram送信者ID抽出失敗", "親メッセージから送信者IDを取得できませんでした");
			writeReplyLog(errorResult);
			return json({ success: false, error: "Instagram user ID not found" });
		}

		// 4. Instagram DMを送信
		let sendResult = sendInstagramDm(instagramUserId, replyText);

		// 認証エラーの場合、トークン更新して再試行
		if (!sendResult.success && sendResult.isAuthError) {
			logWarn("Auth error detected, refreshing token");
			const tokenRefreshResult = refreshToken();

			if (!tokenRefreshResult.success) {
				logError("Token refresh failed", tokenRefreshResult.error);
				const errorResult: ReplyResult = {
					success: false,
					instagramUserId,
					replyText,
					status: "error_instagram_api",
					error: "Token refresh failed",
					details: tokenRefreshResult.error,
				};
				sendErrorNotification("トークン更新失敗", tokenRefreshResult.error ?? "Unknown error");
				writeReplyLog(errorResult);
				return json({ success: false, error: tokenRefreshResult.error });
			}

			// トークン更新成功、再試行
			logInfo("Token refreshed successfully, retrying sendInstagramDm");
			sendResult = sendInstagramDm(instagramUserId, replyText);
		}

		// DM送信失敗
		if (!sendResult.success) {
			logError("Instagram DM send failed", sendResult.error);
			const errorResult: ReplyResult = {
				success: false,
				instagramUserId,
				replyText,
				status: "error_instagram_api",
				error: sendResult.error,
				details: sendResult.error,
			};
			sendErrorNotification("Instagram DM送信失敗", sendResult.error ?? "Unknown error");
			writeReplyLog(errorResult);
			return json({ success: false, error: sendResult.error });
		}

		// 5. 成功時リアクション追加
		addReaction(channel, messageTs, SUCCESS_EMOJI);

		// 6. 成功ログ出力
		const successResult: ReplyResult = {
			success: true,
			instagramUserId,
			replyText,
			status: "success",
			details: "Reply successfully sent to Instagram DM",
		};
		writeReplyLog(successResult);

		logInfo("Slack reply successfully sent to Instagram DM", {
			instagramUserId,
		});

		return json({ success: true });
	} catch (err) {
		logError("Unexpected error in handleSlackReply", err);
		sendErrorNotification(
			"予期しないエラー（Slack返信処理）",
			err instanceof Error ? err.message : String(err),
		);
		return json({ success: false, error: String(err) });
	}
};
