// Slack API呼び出しモジュール
// conversations.repliesで元メッセージ取得、reactions.addでリアクション追加

import { logError, logInfo } from "../../../../common/src/logger";
import { SLACK_BOT_TOKEN } from "../../env";
import type { SlackConversationsRepliesResponse } from "../../types";

interface GetParentMessageSuccess {
	success: true;
	data: {
		text: string;
	};
}

interface GetParentMessageFailure {
	success: false;
	error: string;
}

type GetParentMessageResult = GetParentMessageSuccess | GetParentMessageFailure;

/**
 * スレッドの親メッセージを取得
 * @param channel チャンネルID
 * @param threadTs スレッドのタイムスタンプ
 * @returns 親メッセージのテキスト
 */
export const getParentMessage = (
	channel: string,
	threadTs: string,
): GetParentMessageResult => {
	try {
		const token = SLACK_BOT_TOKEN;
		if (!token) {
			const error = "SLACK_BOT_TOKEN not found";
			logError("Slack API failed", error);
			return { success: false, error };
		}

		logInfo("Fetching parent message from Slack", { channel, threadTs });

		const url = `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}&limit=1`;
		const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
			method: "get",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			muteHttpExceptions: true,
		};

		const response = UrlFetchApp.fetch(url, options);
		const statusCode = response.getResponseCode();
		const responseText = response.getContentText();

		if (statusCode !== 200) {
			const error = `Slack API failed (status: ${statusCode})`;
			logError("Slack API failed", { statusCode, responseText });
			return { success: false, error };
		}

		const data: SlackConversationsRepliesResponse = JSON.parse(responseText);

		if (!data.ok) {
			const error = `Slack API error: ${data.error}`;
			logError("Slack API failed", { error: data.error });
			return { success: false, error };
		}

		// 最初のメッセージがスレッドの親
		const parentMessage = data.messages?.[0];
		if (!parentMessage) {
			const error = "Parent message not found";
			logError("Slack API failed", error);
			return { success: false, error };
		}

		logInfo("Parent message fetched successfully");

		return {
			success: true,
			data: {
				text: parentMessage.text,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Slack API exception", error);
		return { success: false, error: errorMessage };
	}
};

interface AddReactionResult {
	success: boolean;
	error?: string;
}

/**
 * Slackメッセージにリアクションを追加
 * @param channel チャンネルID
 * @param timestamp メッセージのタイムスタンプ
 * @param emoji 絵文字名（コロンなし、例: "white_check_mark"）
 * @returns 追加結果
 */
export const addReaction = (
	channel: string,
	timestamp: string,
	emoji: string,
): AddReactionResult => {
	try {
		const token = SLACK_BOT_TOKEN;
		if (!token) {
			const error = "SLACK_BOT_TOKEN not found";
			logError("Slack API failed", error);
			return { success: false, error };
		}

		logInfo("Adding reaction to Slack message", { channel, timestamp, emoji });

		const url = "https://slack.com/api/reactions.add";
		const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
			method: "post",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			payload: JSON.stringify({
				channel,
				timestamp,
				name: emoji,
			}),
			muteHttpExceptions: true,
		};

		const response = UrlFetchApp.fetch(url, options);
		const statusCode = response.getResponseCode();
		const responseText = response.getContentText();

		if (statusCode !== 200) {
			const error = `Slack API failed (status: ${statusCode})`;
			logError("Slack reaction failed", { statusCode, responseText });
			return { success: false, error };
		}

		const data = JSON.parse(responseText);

		if (!data.ok) {
			// already_reacted は成功扱い
			if (data.error === "already_reacted") {
				logInfo("Reaction already exists, treating as success");
				return { success: true };
			}
			const error = `Slack API error: ${data.error}`;
			logError("Slack reaction failed", { error: data.error });
			return { success: false, error };
		}

		logInfo("Reaction added successfully");
		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Slack reaction exception", error);
		return { success: false, error: errorMessage };
	}
};
