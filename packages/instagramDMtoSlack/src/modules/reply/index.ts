// Slack返信 → Instagram DM送信のオーケストレーション
// Slackスレッド返信からInstagram DMへの転送処理フロー制御（メディア対応）

import { logError, logInfo, logWarn } from "../../../../common/src/logger";
import { refreshToken } from "../../utils/tokenManager";
import type { ReplyResult, SlackEventPayload, SlackFile } from "../../types";
import type { ProcessedMedia, MediaType } from "../media/types";
import { downloadFromSlack } from "../media/downloader";
import { uploadToDrive, generateFileName } from "../media/googleDrive";
import { isDuplicateEvent, markEventAsProcessed } from "./dedup";
import { extractInstagramUserId, parseSlackEvent } from "./parser";
import { addReaction, getParentMessage } from "./slackApi";
import { sendInstagramDm, sendInstagramDmWithMedia, getInstagramMediaType } from "./instagram";
import { writeReplyLog } from "./sheetLogger";
import { sendErrorNotification } from "../forward/notifier";

const SUCCESS_EMOJI = "white_check_mark";

type TextOutput = GoogleAppsScript.Content.TextOutput;

const json = (data: unknown): TextOutput =>
	ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
		ContentService.MimeType.JSON,
	);

/**
 * SlackファイルをGoogle Drive経由で処理
 * @param files Slackファイル配列
 * @param instagramUserId Instagram送信者ID（ファイル名生成用）
 * @returns 処理済みメディア配列とエラー情報
 */
const processSlackFiles = (
	files: SlackFile[],
	instagramUserId: string,
): { processedMedia: ProcessedMedia[]; errors: string[] } => {
	const processedMedia: ProcessedMedia[] = [];
	const errors: string[] = [];

	files.forEach((file, index) => {
		const url = file.url_private_download;
		if (!url) {
			errors.push(`File ${index}: No download URL found`);
			return;
		}

		// メディアタイプを判定
		const mediaType = getInstagramMediaType(file.mimetype);
		if (!mediaType) {
			errors.push(`File ${index}: Unsupported media type (${file.mimetype})`);
			return;
		}

		// Slackからダウンロード
		const downloadResult = downloadFromSlack(url);
		if (!downloadResult.success || !downloadResult.blob) {
			errors.push(`File ${index}: Download failed - ${downloadResult.error}`);
			return;
		}

		// ファイル名を生成（Slackのmimetypeを優先、blobのContent-Typeは信頼しない）
		const fileName = generateFileName(
			instagramUserId,
			file.mimetype,
			index,
		);

		// BlobにMIMEタイプを明示的に設定（Slackの情報を使用）
		downloadResult.blob.setContentType(file.mimetype);

		// Google Driveにアップロード
		const uploadResult = uploadToDrive(downloadResult.blob, fileName);
		if (!uploadResult.success || !uploadResult.publicUrl || !uploadResult.fileId) {
			errors.push(`File ${index}: Upload failed - ${uploadResult.error}`);
			return;
		}

		processedMedia.push({
			type: mediaType as MediaType,
			originalUrl: url,
			driveUrl: uploadResult.publicUrl,
			fileId: uploadResult.fileId,
		});
	});

	return { processedMedia, errors };
};

/**
 * Instagram DMにメディアを送信（認証エラー時はトークン更新して再試行）
 * @param instagramUserId 送信先ID
 * @param mediaUrl メディアURL
 * @param mediaType メディアタイプ
 * @returns 送信結果
 */
const sendMediaWithRetry = (
	instagramUserId: string,
	mediaUrl: string,
	mediaType: MediaType,
): { success: boolean; error?: string } => {
	let sendResult = sendInstagramDmWithMedia(instagramUserId, mediaUrl, mediaType);

	if (!sendResult.success && sendResult.isAuthError) {
		logWarn("Auth error detected during media send, refreshing token");
		const tokenRefreshResult = refreshToken();

		if (tokenRefreshResult.success) {
			logInfo("Token refreshed successfully, retrying media send");
			sendResult = sendInstagramDmWithMedia(instagramUserId, mediaUrl, mediaType);
		}
	}

	return sendResult;
};

/**
 * Slackスレッド返信からInstagram DMを送信（メディア対応版）
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

		const { channel, threadTs, messageTs, replyText, files } = parseResult.data;

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

		// 4. メディア処理（ファイルがある場合）
		let processedMedia: ProcessedMedia[] = [];
		let mediaErrors: string[] = [];
		const mediaSendErrors: string[] = [];

		if (files && files.length > 0) {
			logInfo("Processing Slack files", { count: files.length });
			const mediaResult = processSlackFiles(files, instagramUserId);
			processedMedia = mediaResult.processedMedia;
			mediaErrors = mediaResult.errors;

			if (mediaErrors.length > 0) {
				logWarn("Some media processing failed", { errors: mediaErrors });
			}

			// メディアをInstagramに送信
			for (const media of processedMedia) {
				const sendResult = sendMediaWithRetry(instagramUserId, media.driveUrl, media.type);
				if (!sendResult.success) {
					mediaSendErrors.push(`${media.type}: ${sendResult.error}`);
				}
			}
		}

		// 5. テキストメッセージがある場合はInstagram DMを送信
		const hasText = replyText && replyText.trim().length > 0;
		let textSendSuccess = true;
		let textSendError: string | undefined;

		if (hasText) {
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

			if (!sendResult.success) {
				textSendSuccess = false;
				textSendError = sendResult.error;
			}
		}

		// 6. 結果判定
		const allMediaSuccess = mediaSendErrors.length === 0 && mediaErrors.length === 0;
		const hasMedia = processedMedia.length > 0;
		const overallSuccess = textSendSuccess && (hasMedia ? allMediaSuccess : true);
		const isPartialSuccess = !overallSuccess && (textSendSuccess || mediaSendErrors.length < processedMedia.length);

		// テキスト送信も失敗し、メディアも全て失敗の場合
		if (!textSendSuccess && (!hasMedia || mediaSendErrors.length === processedMedia.length)) {
			logError("All sends failed", { textError: textSendError, mediaErrors: mediaSendErrors });
			const errorResult: ReplyResult = {
				success: false,
				instagramUserId,
				replyText,
				status: "error_instagram_api",
				error: textSendError ?? "All media sends failed",
				details: [textSendError, ...mediaErrors, ...mediaSendErrors].filter(Boolean).join(", "),
			};
			sendErrorNotification("Instagram DM送信失敗", textSendError ?? "All sends failed");
			writeReplyLog(errorResult);
			return json({ success: false, error: textSendError });
		}

		// 7. 成功時リアクション追加
		addReaction(channel, messageTs, SUCCESS_EMOJI);

		// 8. 成功ログ出力
		const mediaUrls = processedMedia.map((m) => m.driveUrl);
		const allErrors = [...mediaErrors, ...mediaSendErrors];

		const successResult: ReplyResult = {
			success: true,
			instagramUserId,
			replyText,
			status: isPartialSuccess ? "partial_success" : "success",
			details: isPartialSuccess
				? `Reply sent with ${allErrors.length} error(s): ${allErrors.join(", ")}`
				: "Reply successfully sent to Instagram DM",
			mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
		};
		writeReplyLog(successResult);

		logInfo("Slack reply successfully sent to Instagram DM", {
			instagramUserId,
			mediaCount: processedMedia.length,
			isPartialSuccess,
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
