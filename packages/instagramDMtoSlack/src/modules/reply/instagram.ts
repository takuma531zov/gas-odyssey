// Instagram Messages API呼び出しモジュール
// Instagram Graph API経由でDMを送信（テキスト）とエラー解析ユーティリティ
// メディアはattachment_id方式（instagramAttachment.ts）で送信する

import { logError, logInfo } from "../../../../common/src/logger";
import { INSTAGRAM_API_TOKEN, INSTAGRAM_PAGE_ID } from "../../env";

/** Instagram DM送信結果 */
export interface SendDmResult {
  success: boolean;
  isAuthError?: boolean;
  error?: string;
}

/** メディアタイプ（Instagram API用） */
export type InstagramMediaType = "image" | "video" | "audio";

/**
 * Instagramエラーレスポンスからエラーコードとログシート向けの詳細文字列を抽出
 * doPost実行ログには詳細が残らないため、原因特定に必要な
 * subcode / user_title / user_msg / fbtrace_id を返信ログシートへ渡す
 * @param responseText Instagram APIのレスポンス本文（JSON）
 * @returns エラーコードと診断用の詳細文字列
 */
export const parseInstagramError = (
  responseText: string,
): { errorCode?: number; detail: string } => {
  const parsed = JSON.parse(responseText);
  const err = parsed?.error ?? {};
  const detail =
    [
      err.message,
      err.error_subcode ? `subcode=${err.error_subcode}` : null,
      err.error_user_title,
      err.error_user_msg,
      err.fbtrace_id ? `trace=${err.fbtrace_id}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || responseText;
  return { errorCode: err.code, detail };
};

/**
 * Instagram DMを送信（テキストのみ）
 * @param recipientId 送信先のInstagramユーザーID
 * @param messageText 送信するメッセージ
 * @returns 送信結果
 */
export const sendInstagramDm = (
  recipientId: string,
  messageText: string,
): SendDmResult => {
  try {
    const token = INSTAGRAM_API_TOKEN;
    const pageId = INSTAGRAM_PAGE_ID;

    if (!token) {
      const error = "INSTAGRAM_API_TOKEN not found";
      logError("Instagram API failed", error);
      return { success: false, error };
    }

    if (!pageId) {
      const error = "INSTAGRAM_PAGE_ID not found";
      logError("Instagram API failed", error);
      return { success: false, error };
    }

    logInfo("Sending Instagram DM", { recipientId });

    // Instagram Graph API: Messages送信
    const url = `https://graph.instagram.com/v21.0/${pageId}/messages`;
    const payload = {
      recipient: {
        id: recipientId,
      },
      message: {
        text: messageText,
      },
    };

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    // 認証エラー判定（401または特定のエラーコード）
    if (statusCode === 401) {
      const error = "Instagram API authentication error";
      logError("Instagram API auth error", { statusCode, responseText });
      return { success: false, isAuthError: true, error };
    }

    // その他のエラー
    if (statusCode < 200 || statusCode >= 300) {
      logError("Instagram API failed", { statusCode, responseText });

      // 認証関連のエラーコードをチェック（詳細はエラー文字列に含めてログシートへ）
      const { errorCode, detail } = parseInstagramError(responseText);
      if (errorCode === 190 || errorCode === 102) {
        return {
          success: false,
          isAuthError: true,
          error: `Auth error (${statusCode}): ${detail}`,
        };
      }

      return {
        success: false,
        error: `Instagram API failed (${statusCode}): ${detail}`,
      };
    }

    logInfo("Instagram DM sent successfully", { recipientId });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError("Instagram API exception", error);
    return { success: false, error: errorMessage };
  }
};

/**
 * MIMEタイプからInstagramメディアタイプを判定
 * @param mimeType MIMEタイプ
 * @returns Instagramメディアタイプまたはnull（非対応の場合）
 */
export const getInstagramMediaType = (
  mimeType: string,
): InstagramMediaType | null => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  return null;
};
