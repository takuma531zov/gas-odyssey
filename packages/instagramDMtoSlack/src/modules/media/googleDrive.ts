// Google Drive操作モジュール
// メディアファイルのアップロード、共有設定、公開URL取得

import { logError, logInfo } from "../../../../common/src/logger";
import { IMAGE_TEMP_FOLDER_ID } from "../../env";
import type { DriveUploadResult } from "./types";

/**
 * BlobをGoogle Driveにアップロードし、公開URLを取得
 * @param blob アップロードするBlob
 * @param fileName ファイル名
 * @returns アップロード結果（fileId, 公開URL）
 */
export const uploadToDrive = (
	blob: GoogleAppsScript.Base.Blob,
	fileName: string,
): DriveUploadResult => {
	try {
		const folderId = IMAGE_TEMP_FOLDER_ID;
		if (!folderId) {
			const error = "IMAGE_TEMP_FOLDER_ID not found";
			logError("Drive upload failed", error);
			return { success: false, error };
		}

		logInfo("Uploading file to Google Drive", { fileName });

		// フォルダを取得
		const folder = DriveApp.getFolderById(folderId);

		// ファイルを作成
		const file = folder.createFile(blob).setName(fileName);

		// 公開設定（リンクを知っている全員が閲覧可能）
		file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

		const fileId = file.getId();
		// リダイレクトなしの直接ダウンロードURL（Instagram API対応）
		const publicUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;

		logInfo("File uploaded to Drive successfully", { fileId, fileName });

		return {
			success: true,
			fileId,
			publicUrl,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Drive upload exception", error);
		return { success: false, error: errorMessage };
	}
};

/**
 * メディアファイル用のファイル名を生成
 * @param senderId 送信者ID
 * @param mimeType MIMEタイプ
 * @param index 複数メディア時のインデックス
 * @returns ファイル名
 */
export const generateFileName = (
	senderId: string,
	mimeType: string,
	index: number,
): string => {
	const timestamp = Date.now();
	const ext = getExtensionFromMimeType(mimeType);
	return `instagram_dm_${senderId}_${timestamp}_${index}.${ext}`;
};

/**
 * MIMEタイプから拡張子を取得
 * @param mimeType MIMEタイプ
 * @returns 拡張子
 */
const getExtensionFromMimeType = (mimeType: string): string => {
	const mimeToExt: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
		"video/mp4": "mp4",
		"video/quicktime": "mov",
		"audio/mpeg": "mp3",
		"audio/mp4": "m4a",
		"audio/ogg": "ogg",
	};

	return mimeToExt[mimeType] ?? "bin";
};
