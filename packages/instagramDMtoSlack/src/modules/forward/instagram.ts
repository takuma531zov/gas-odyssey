// Instagram Graph API操作モジュール
// ユーザー情報の取得とAPIエラーハンドリング

import { fetchData } from "../../../../common/src/utils";
import { logError, logInfo } from "../../../../common/src/logger";
import { INSTAGRAM_API_TOKEN } from "../../env";
import type { InstagramUserInfo } from "../../types";

/**
 * Instagram Graph APIでユーザー情報を取得
 * @param senderId 送信者ID
 * @returns 成功時はユーザー情報、失敗時はエラー（認証エラーかどうかも返却）
 */
export const getUserInfo = (
	senderId: string,
):
	| { success: true; data: InstagramUserInfo }
	| { success: false; error: string; isAuthError: boolean } => {
	try {
		logInfo("Getting Instagram user info", { senderId });

		const token = INSTAGRAM_API_TOKEN;
		if (!token) {
			const error = "Instagram API token not found";
			logError("Instagram API failed", error);
			return { success: false, error, isAuthError: false };
		}

		// Instagram Graph API: ユーザー情報取得
		const url = `https://graph.instagram.com/v24.0/${senderId}?fields=name,username`;
		const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
			method: "get",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			muteHttpExceptions: true,
		};

		const { responseData, statusCode } = fetchData(url, options);

		// 成功判定
		if (statusCode === 200 && responseData) {
			const userInfo = responseData as InstagramUserInfo;
			logInfo("Instagram user info retrieved", {
				senderId,
				username: userInfo.username,
			});
			return { success: true, data: userInfo };
		}

		// 認証エラー判定（401 Unauthorized, 403 Forbidden）
		if (statusCode === 401 || statusCode === 403) {
			const error = `Authentication error (status: ${statusCode})`;
			logError("Instagram API auth error", {
				statusCode,
				senderId,
				responseData,
			});
			return { success: false, error, isAuthError: true };
		}

		// その他のエラー
		const error = `Instagram API failed (status: ${statusCode})`;
		logError("Instagram API failed", { statusCode, senderId, responseData });
		return { success: false, error, isAuthError: false };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Instagram API exception", error);
		return { success: false, error: errorMessage, isAuthError: false };
	}
};
