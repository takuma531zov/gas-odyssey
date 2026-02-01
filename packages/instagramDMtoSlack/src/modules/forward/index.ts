// 処理フローのオーケストレーション
// Instagram DM受信からSlack通知までの処理フロー制御（メディア対応）

import { logError, logInfo, logWarn } from "../../../../common/src/logger";
import type { ProcessResult, InstagramAttachment } from "../../types";
import type { ProcessedMedia, MediaType } from "../media/types";
import { downloadFromUrl } from "../media/downloader";
import { uploadToDrive, generateFileName } from "../media/googleDrive";
import { parseWebhook } from "./parser";
import { getUserInfo } from "./instagram";
import { refreshToken } from "../../utils/tokenManager";
import { formatSlackPayload, formatTimestamp } from "./formatter";
import { sendToSlackWithPayload } from "./slack";
import { writeLog } from "./sheetLogger";
import { sendErrorNotification } from "./notifier";

type TextOutput = GoogleAppsScript.Content.TextOutput;

const json = (data: unknown): TextOutput =>
	ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
		ContentService.MimeType.JSON,
	);

/**
 * Instagram添付ファイルをGoogle Drive経由で処理
 * @param attachments Instagram添付ファイル配列
 * @param senderId 送信者ID
 * @returns 処理済みメディア配列とエラー情報
 */
const processAttachments = (
	attachments: InstagramAttachment[],
	senderId: string,
): { processedMedia: ProcessedMedia[]; errors: string[] } => {
	const processedMedia: ProcessedMedia[] = [];
	const errors: string[] = [];

	attachments.forEach((attachment, index) => {
		const url = attachment.payload?.url;
		if (!url) {
			errors.push(`Attachment ${index}: No URL found`);
			return;
		}

		// メディアをダウンロード
		const downloadResult = downloadFromUrl(url);
		if (!downloadResult.success || !downloadResult.blob) {
			errors.push(`Attachment ${index}: Download failed - ${downloadResult.error}`);
			return;
		}

		// ファイル名を生成
		const fileName = generateFileName(
			senderId,
			downloadResult.mimeType ?? "application/octet-stream",
			index,
		);

		// Google Driveにアップロード
		const uploadResult = uploadToDrive(downloadResult.blob, fileName);
		if (!uploadResult.success || !uploadResult.publicUrl || !uploadResult.fileId) {
			errors.push(`Attachment ${index}: Upload failed - ${uploadResult.error}`);
			return;
		}

		processedMedia.push({
			type: attachment.type as MediaType,
			originalUrl: url,
			driveUrl: uploadResult.publicUrl,
			fileId: uploadResult.fileId,
		});
	});

	return { processedMedia, errors };
};

/**
 * Instagram WebhookイベントをGASで処理（メディア対応版）
 * @param e DoPostイベント
 * @returns TextOutput(JSON)
 */
export const handleDoPost = (
	e: GoogleAppsScript.Events.DoPost,
): TextOutput => {
	try {
		const payload = e.postData.contents;
		logInfo("Instagram Webhook event received");

		// 1. Webhook解析
		const parseResult = parseWebhook(payload);

		if (!parseResult.success) {
			// スキップケース（エコー・既読）
			if (parseResult.reason === "skip") {
				logWarn("Event skipped", { reason: parseResult.error });
				return json({ success: true, message: "Event skipped" });
			}

			// 解析エラー
			logError("Webhook parse failed", parseResult.error);
			const errorResult: ProcessResult = {
				success: false,
				status: "error_parse",
				error: parseResult.error,
				details: parseResult.error,
			};
			sendErrorNotification("Webhook解析失敗", parseResult.error);
			writeLog(errorResult);
			return json({ success: false, error: parseResult.error });
		}

		const { senderId, messageText, timestamp, attachments } = parseResult.data;

		// 2. Instagram API呼び出し（ユーザー情報取得）
		let userInfoResult = getUserInfo(senderId);

		// 認証エラーの場合、トークン更新して再試行
		if (!userInfoResult.success && userInfoResult.isAuthError) {
			logWarn("Auth error detected, refreshing token");
			const tokenRefreshResult = refreshToken();

			if (!tokenRefreshResult.success) {
				// トークン更新失敗
				logError("Token refresh failed", tokenRefreshResult.error);
				const errorResult: ProcessResult = {
					success: false,
					senderId,
					messageText,
					timestamp: formatTimestamp(timestamp),
					status: "error_api",
					error: "Token refresh failed",
					details: tokenRefreshResult.error,
				};
				sendErrorNotification(
					"トークン更新失敗",
					tokenRefreshResult.error ?? "Unknown error",
				);
				writeLog(errorResult);
				return json({ success: false, error: tokenRefreshResult.error });
			}

			// トークン更新成功、再試行
			logInfo("Token refreshed successfully, retrying getUserInfo");
			userInfoResult = getUserInfo(senderId);
		}

		// API失敗（再試行後も失敗）
		if (!userInfoResult.success) {
			logError("Instagram API failed", userInfoResult.error);
			const errorResult: ProcessResult = {
				success: false,
				senderId,
				messageText,
				timestamp: formatTimestamp(timestamp),
				status: "error_api",
				error: userInfoResult.error,
				details: userInfoResult.error,
			};
			sendErrorNotification("Instagram API失敗", userInfoResult.error);
			writeLog(errorResult);
			return json({ success: false, error: userInfoResult.error });
		}

		const userInfo = userInfoResult.data;

		// 3. メディア処理（添付ファイルがある場合）
		let processedMedia: ProcessedMedia[] = [];
		let mediaErrors: string[] = [];

		if (attachments && attachments.length > 0) {
			logInfo("Processing media attachments", { count: attachments.length });
			const mediaResult = processAttachments(attachments, senderId);
			processedMedia = mediaResult.processedMedia;
			mediaErrors = mediaResult.errors;

			if (mediaErrors.length > 0) {
				logWarn("Some media processing failed", { errors: mediaErrors });
			}
		}

		// 4. Slackメッセージ整形（Block Kit対応）
		const slackPayload = formatSlackPayload(
			userInfo,
			messageText,
			timestamp,
			processedMedia.length > 0 ? processedMedia : undefined,
		);

		// 5. Slack送信
		const slackResult = sendToSlackWithPayload(slackPayload);

		if (!slackResult.success) {
			logError("Slack send failed", slackResult.error);
			const errorResult: ProcessResult = {
				success: false,
				senderId,
				senderName: userInfo.name,
				username: userInfo.username,
				messageText,
				timestamp: formatTimestamp(timestamp),
				status: "error_slack",
				error: slackResult.error,
				details: slackResult.error,
			};
			sendErrorNotification(
				"Slack送信失敗",
				slackResult.error ?? "Unknown error",
			);
			writeLog(errorResult);
			return json({ success: false, error: slackResult.error });
		}

		// 6. 成功ログ出力
		const hasMediaError = mediaErrors.length > 0;
		const mediaUrls = processedMedia.map((m) => m.driveUrl);

		const successResult: ProcessResult = {
			success: true,
			senderId,
			senderName: userInfo.name,
			username: userInfo.username,
			messageText,
			timestamp: formatTimestamp(timestamp),
			status: hasMediaError ? "partial_success" : "success",
			details: hasMediaError
				? `DM forwarded with ${mediaErrors.length} media error(s): ${mediaErrors.join(", ")}`
				: "DM successfully forwarded to Slack",
			mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
		};
		writeLog(successResult);

		logInfo("Instagram DM successfully forwarded to Slack", {
			senderId,
			username: userInfo.username,
			mediaCount: processedMedia.length,
		});

		return json({ success: true });
	} catch (err) {
		logError("Unexpected error in handleDoPost", err);
		sendErrorNotification(
			"予期しないエラー",
			err instanceof Error ? err.message : String(err),
		);
		return json({ success: false, error: String(err) });
	}
};
