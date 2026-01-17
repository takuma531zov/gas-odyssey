// 型定義ファイル
// Instagram Webhook、API、処理結果などの型を定義

// Instagram Webhook関連
export interface InstagramWebhookPayload {
	entry: InstagramEntry[];
}

export interface InstagramEntry {
	id: string;
	time: number;
	messaging: InstagramMessage[];
}

export interface InstagramMessage {
	sender: { id: string };
	recipient: { id: string };
	timestamp: number;
	message?: {
		mid: string;
		text: string;
		is_echo?: boolean;
	};
	read?: {
		mid: string;
	};
}

// Instagram API関連
export interface InstagramUserInfo {
	id: string;
	name: string;
	username: string;
}

export interface InstagramTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	permissions?: string;
}

// 処理結果関連
export interface ParsedMessage {
	senderId: string;
	messageText: string;
	timestamp: number;
}

export interface ProcessResult {
	success: boolean;
	senderId?: string;
	senderName?: string;
	username?: string;
	messageText?: string;
	timestamp?: string;
	status: ProcessStatus;
	error?: string;
	details?: string;
}

export type ProcessStatus =
	| "success"
	| "skipped_echo"
	| "skipped_read"
	| "error_parse"
	| "error_api"
	| "error_slack"
	| "error_log";

// ログ出力用
export interface LogEntry {
	timestamp: string;
	senderId: string;
	senderName: string;
	username: string;
	messageText: string;
	status: string;
	details: string;
}

// Slack Event関連
export interface SlackEventPayload {
	token: string;
	team_id: string;
	api_app_id: string;
	event: SlackMessageEvent;
	type: "event_callback";
	event_id: string;
	event_time: number;
}

export interface SlackMessageEvent {
	type: "message";
	subtype?: string;
	channel: string;
	user: string;
	text: string;
	ts: string;
	thread_ts?: string;
	event_ts: string;
	channel_type: string;
}

export interface SlackUrlVerificationPayload {
	type: "url_verification";
	token: string;
	challenge: string;
}

export interface SlackConversationsRepliesResponse {
	ok: boolean;
	messages?: SlackMessage[];
	error?: string;
}

export interface SlackMessage {
	type: string;
	user: string;
	text: string;
	ts: string;
	thread_ts?: string;
}

// リクエスト種別
export type RequestType =
	| "slack_url_verification"
	| "slack_event"
	| "instagram_webhook"
	| "unknown";

// 返信処理結果
export interface ReplyResult {
	success: boolean;
	instagramUserId?: string;
	replyText?: string;
	timestamp?: string;
	status: ReplyStatus;
	error?: string;
	details?: string;
}

export type ReplyStatus =
	| "success"
	| "skipped_not_thread"
	| "skipped_bot_message"
	| "error_parse"
	| "error_slack_api"
	| "error_instagram_api"
	| "error_log";
