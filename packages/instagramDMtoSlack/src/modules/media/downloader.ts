// メディアダウンロードモジュール
// Instagram/Slackからのメディアファイル取得

import { logError, logInfo } from "../../../../common/src/logger";
import { SLACK_BOT_TOKEN } from "../../env";
import type { MediaDownloadResult } from "./types";

/**
 * URLからメディアをダウンロード（Instagram用）
 * @param url メディアURL
 * @returns ダウンロード結果（Blob）
 */
export const downloadFromUrl = (url: string): MediaDownloadResult => {
	try {
		logInfo("Downloading media from URL", { url: url.substring(0, 50) });

		const response = UrlFetchApp.fetch(url, {
			muteHttpExceptions: true,
			followRedirects: true,
		});

		const statusCode = response.getResponseCode();
		if (statusCode < 200 || statusCode >= 300) {
			const error = `Download failed (status: ${statusCode})`;
			logError("Media download failed", { statusCode, url });
			return { success: false, error };
		}

		const blob = response.getBlob();
		const mimeType = blob.getContentType() ?? "application/octet-stream";

		logInfo("Media downloaded successfully", { mimeType });

		return {
			success: true,
			blob,
			mimeType,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Media download exception", error);
		return { success: false, error: errorMessage };
	}
};

/**
 * SlackのプライベートURLからファイルをダウンロード
 * @param url Slackのurl_private_download
 * @returns ダウンロード結果（Blob）
 */
export const downloadFromSlack = (url: string): MediaDownloadResult => {
	try {
		const token = SLACK_BOT_TOKEN;
		if (!token) {
			const error = "SLACK_BOT_TOKEN not found";
			logError("Slack file download failed", error);
			return { success: false, error };
		}

		logInfo("Downloading file from Slack", { url: url.substring(0, 50) });

		const response = UrlFetchApp.fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
			muteHttpExceptions: true,
			followRedirects: true,
		});

		const statusCode = response.getResponseCode();
		if (statusCode < 200 || statusCode >= 300) {
			const error = `Slack download failed (status: ${statusCode})`;
			logError("Slack file download failed", { statusCode });
			return { success: false, error };
		}

		const blob = response.getBlob();
		const mimeType = blob.getContentType() ?? "application/octet-stream";
		const blobSize = blob.getBytes().length;

		// HTMLが返された場合はエラー（Slackの認証エラー等）
		if (mimeType.includes("text/html")) {
			const htmlContent = response.getContentText().substring(0, 200);
			const error = `Slack returned HTML instead of file: ${htmlContent}`;
			logError("Slack file download returned HTML", { mimeType, htmlContent });
			return { success: false, error };
		}

		logInfo("Slack file downloaded successfully", { mimeType, blobSize });

		return {
			success: true,
			blob,
			mimeType,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Slack file download exception", error);
		return { success: false, error: errorMessage };
	}
};
