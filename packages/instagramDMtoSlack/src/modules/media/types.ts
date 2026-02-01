// メディア関連の型定義
// Instagram/Slack間のメディア転送で使用する型を定義

/** メディアの種類 */
export type MediaType = "image" | "video" | "audio";

/** Instagramの添付ファイル情報 */
export interface InstagramAttachment {
	type: MediaType;
	payload: {
		url: string;
	};
}

/** Slackのファイル情報 */
export interface SlackFile {
	id: string;
	name: string;
	mimetype: string;
	url_private_download: string;
}

/** Google Driveへのアップロード結果 */
export interface DriveUploadResult {
	success: boolean;
	fileId?: string;
	publicUrl?: string;
	error?: string;
}

/** メディアダウンロード結果 */
export interface MediaDownloadResult {
	success: boolean;
	blob?: GoogleAppsScript.Base.Blob;
	mimeType?: string;
	error?: string;
}

/** 処理済みメディア情報 */
export interface ProcessedMedia {
	type: MediaType;
	originalUrl: string;
	driveUrl: string;
	fileId: string;
}

/** メディア処理結果 */
export interface MediaProcessResult {
	success: boolean;
	processedMedia?: ProcessedMedia[];
	failedCount?: number;
	errors?: string[];
}
