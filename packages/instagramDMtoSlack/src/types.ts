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
