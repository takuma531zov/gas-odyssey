// Instagram Attachment Upload モジュール
// メディアの生ファイルをInstagramへ直接アップロードしてattachment_idを取得し、
// そのidでDM送信する。公開URL(Drive)依存を排除し、Meta側の取得失敗(2018007)を回避する

import { logError, logInfo } from "../../../../common/src/logger";
import { INSTAGRAM_API_TOKEN, INSTAGRAM_PAGE_ID } from "../../env";
import {
  type InstagramMediaType,
  type SendDmResult,
  parseInstagramError,
} from "./instagram";

/** 添付アップロード結果 */
interface UploadAttachmentResult {
  success: boolean;
  attachmentId?: string;
  isAuthError?: boolean;
  error?: string;
}

/**
 * メディアの生ファイルをInstagramにアップロードしてattachment_idを取得
 * message_attachmentsエンドポイントにmultipart(filedata)で直接送信する
 * @param blob アップロードするメディアBlob（ファイル名はASCIIであること）
 * @param mediaType メディアタイプ
 * @returns attachment_idを含むアップロード結果
 */
export const uploadInstagramAttachment = (
  blob: GoogleAppsScript.Base.Blob,
  mediaType: InstagramMediaType,
): UploadAttachmentResult => {
  try {
    const token = INSTAGRAM_API_TOKEN;
    const pageId = INSTAGRAM_PAGE_ID;

    if (!token) {
      const error = "INSTAGRAM_API_TOKEN not found";
      logError("Instagram attachment upload failed", error);
      return { success: false, error };
    }

    if (!pageId) {
      const error = "INSTAGRAM_PAGE_ID not found";
      logError("Instagram attachment upload failed", error);
      return { success: false, error };
    }

    logInfo("Uploading attachment to Instagram", { mediaType });

    // Instagram Graph API: 添付アップロード（生ファイルをmultipartで送信）
    const url = `https://graph.instagram.com/v21.0/${pageId}/message_attachments`;
    const message = JSON.stringify({
      attachment: {
        type: mediaType,
        payload: { is_reusable: true },
      },
    });

    // payloadをオブジェクトで渡すとUrlFetchAppがmultipart/form-dataで送信する
    // （contentTypeは指定しない：boundaryを自動付与させるため）
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        message,
        filedata: blob,
      },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    // 認証エラー判定
    if (statusCode === 401) {
      const error = "Instagram API authentication error";
      logError("Instagram attachment auth error", { statusCode, responseText });
      return { success: false, isAuthError: true, error };
    }

    // その他のエラー（詳細はエラー文字列に含めてログシートへ）
    if (statusCode < 200 || statusCode >= 300) {
      logError("Instagram attachment upload failed", {
        statusCode,
        responseText,
      });
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
        error: `Attachment upload failed (${statusCode}): ${detail}`,
      };
    }

    const parsed = JSON.parse(responseText);
    const attachmentId = parsed?.attachment_id;
    if (!attachmentId) {
      const error = `No attachment_id in response: ${responseText}`;
      logError("Instagram attachment upload missing id", { responseText });
      return { success: false, error };
    }

    logInfo("Instagram attachment uploaded", { mediaType });
    return { success: true, attachmentId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError("Instagram attachment upload exception", error);
    return { success: false, error: errorMessage };
  }
};

/**
 * attachment_idを使ってInstagram DMにメディアを送信
 * @param recipientId 送信先のInstagramユーザーID
 * @param attachmentId アップロード済みメディアのattachment_id
 * @param mediaType メディアタイプ
 * @returns 送信結果
 */
export const sendInstagramDmWithAttachmentId = (
  recipientId: string,
  attachmentId: string,
  mediaType: InstagramMediaType,
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

    logInfo("Sending Instagram DM with attachment", { recipientId, mediaType });

    // Instagram Graph API: Messages送信（attachment_id添付）
    const url = `https://graph.instagram.com/v21.0/${pageId}/messages`;
    const payload = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: mediaType,
          payload: { attachment_id: attachmentId },
        },
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

    // 認証エラー判定
    if (statusCode === 401) {
      const error = "Instagram API authentication error";
      logError("Instagram API auth error", { statusCode, responseText });
      return { success: false, isAuthError: true, error };
    }

    // その他のエラー（詳細はエラー文字列に含めてログシートへ）
    if (statusCode < 200 || statusCode >= 300) {
      logError("Instagram API failed", { statusCode, responseText });
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

    logInfo("Instagram DM with attachment sent successfully", {
      recipientId,
      mediaType,
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError("Instagram API exception", error);
    return { success: false, error: errorMessage };
  }
};
