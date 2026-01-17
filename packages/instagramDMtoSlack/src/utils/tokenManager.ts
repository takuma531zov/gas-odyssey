// Instagram APIトークン管理・更新モジュール
// APIトークンの自動更新機能を提供

import { fetchData } from "../../../common/src/utils";
import { logError, logInfo } from "../../../common/src/logger";
import { INSTAGRAM_API_TOKEN, SCRIPT_PROPERTIES } from "../env";
import type { InstagramTokenResponse } from "../types";

/**
 * Instagram APIトークンを更新
 * @returns 成功時true、失敗時false
 */
export const refreshToken = (): { success: boolean; error?: string } => {
	try {
		const currentToken = INSTAGRAM_API_TOKEN;
		if (!currentToken) {
			const error = "Current token not found";
			logError("Token refresh failed", error);
			return { success: false, error };
		}

		logInfo("Refreshing Instagram API token");

		// Instagram Graph API: トークン更新
		const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`;
		const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
			method: "get",
			muteHttpExceptions: true,
		};

		const { responseData, statusCode } = fetchData(url, options);

		if (statusCode !== 200 || !responseData) {
			const error = `Token refresh API failed (status: ${statusCode})`;
			logError("Token refresh failed", { statusCode, responseData });
			return { success: false, error };
		}

		const tokenResponse = responseData as InstagramTokenResponse;
		const newToken = tokenResponse.access_token;

		if (!newToken) {
			const error = "New token not found in response";
			logError("Token refresh failed", error);
			return { success: false, error };
		}

		// 新しいトークンをスクリプトプロパティに保存
		updateTokenProperty(newToken);

		logInfo("Instagram API token refreshed successfully", {
			expires_in: tokenResponse.expires_in,
		});

		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logError("Token refresh exception", error);
		return { success: false, error: errorMessage };
	}
};

/**
 * スクリプトプロパティにトークンを保存
 * @param newToken 新しいトークン
 */
export const updateTokenProperty = (newToken: string): void => {
	PropertiesService.getScriptProperties().setProperty(
		SCRIPT_PROPERTIES.INSTAGRAM_API_TOKEN,
		newToken,
	);
	logInfo("Instagram API token updated in script properties");
};
