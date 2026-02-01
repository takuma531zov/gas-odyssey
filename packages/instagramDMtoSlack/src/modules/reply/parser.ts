// Slack Eventペイロード解析モジュール
// Slackイベントからスレッド返信情報を抽出（ファイル添付対応）

import { logInfo, logWarn } from "../../../../common/src/logger";
import type { SlackEventPayload, SlackFile } from "../../types";

interface ParseSuccessResult {
	success: true;
	data: {
		channel: string;
		threadTs: string;
		messageTs: string;
		replyText: string;
		userId: string;
		files?: SlackFile[];
	};
}

interface ParseFailureResult {
	success: false;
	reason: "skip" | "error";
	error: string;
}

type ParseResult = ParseSuccessResult | ParseFailureResult;

/**
 * Slack Eventペイロードを解析
 * テキストまたはファイルのいずれかがあれば成功
 * @param payload リクエストペイロード（JSON文字列）
 * @returns 解析結果
 */
export const parseSlackEvent = (payload: string): ParseResult => {
	try {
		const parsed: SlackEventPayload = JSON.parse(payload);
		const event = parsed.event;

		// メッセージイベント以外はスキップ
		if (event.type !== "message") {
			logWarn("Event skipped: not a message event", { type: event.type });
			return { success: false, reason: "skip", error: "Not a message event" };
		}

		// subtypeがある場合（bot_message、message_changed等）はスキップ
		// ただし file_share は許可（ファイル添付）
		if (event.subtype && event.subtype !== "file_share") {
			logWarn("Event skipped: has subtype", { subtype: event.subtype });
			return { success: false, reason: "skip", error: `Message has subtype: ${event.subtype}` };
		}

		// スレッド返信でない場合はスキップ
		if (!event.thread_ts) {
			logWarn("Event skipped: not a thread reply");
			return { success: false, reason: "skip", error: "Not a thread reply" };
		}

		// 自分自身（元メッセージ）への返信かチェック（thread_tsとtsが同じ場合はスレッドの親）
		if (event.ts === event.thread_ts) {
			logWarn("Event skipped: thread parent message");
			return { success: false, reason: "skip", error: "Thread parent message" };
		}

		// テキストもファイルもない場合はスキップ
		const hasText = event.text && event.text.trim().length > 0;
		const hasFiles = event.files && event.files.length > 0;
		if (!hasText && !hasFiles) {
			logWarn("Event skipped: no text or files");
			return { success: false, reason: "skip", error: "No text or files in message" };
		}

		logInfo("Slack event parsed successfully", {
			channel: event.channel,
			threadTs: event.thread_ts,
			hasFiles: hasFiles,
		});

		return {
			success: true,
			data: {
				channel: event.channel,
				threadTs: event.thread_ts,
				messageTs: event.ts,
				replyText: event.text,
				userId: event.user,
				files: event.files,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, reason: "error", error: errorMessage };
	}
};

/**
 * Slackメッセージ本文からInstagram送信者IDを抽出
 * @param messageText 元メッセージの本文
 * @returns Instagram送信者ID（見つからない場合はnull）
 */
export const extractInstagramUserId = (messageText: string): string | null => {
	// フォーマット: *送信者ID:* 12345...
	const match = messageText.match(/\*送信者ID:\*\s*(\d+)/);
	return match?.[1] ?? null;
};
