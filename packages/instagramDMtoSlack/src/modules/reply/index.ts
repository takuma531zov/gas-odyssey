// Slack返信 → Instagram DM送信のオーケストレーション
// Slackスレッド返信からInstagram DMへの転送処理フロー制御（メディア対応）
// メディアはInstagramへ直接アップロード(attachment_id)して送信し、公開URL依存を排除する

import { logError, logInfo, logWarn } from "../../../../common/src/logger";
import type { ReplyResult, SlackEventPayload, SlackFile } from "../../types";
import { refreshToken } from "../../utils/tokenManager";
import { sendErrorNotification } from "../forward/notifier";
import { downloadFromSlack } from "../media/downloader";
import { generateFileName } from "../media/googleDrive";
import type { MediaType } from "../media/types";
import { isDuplicateEvent, markEventAsProcessed } from "./dedup";
import { getInstagramMediaType, sendInstagramDm } from "./instagram";
import {
  sendInstagramDmWithAttachmentId,
  uploadInstagramAttachment,
} from "./instagramAttachment";
import { extractInstagramUserId, parseSlackEvent } from "./parser";
import { writeReplyLog } from "./sheetLogger";
import { addReaction, getParentMessage } from "./slackApi";

const SUCCESS_EMOJI = "white_check_mark";

type TextOutput = GoogleAppsScript.Content.TextOutput;

/** Slackから取得しInstagram送信準備が整ったメディア */
interface DownloadedMedia {
  type: MediaType;
  blob: GoogleAppsScript.Base.Blob;
}

const json = (data: unknown): TextOutput =>
  ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );

/**
 * SlackファイルをダウンロードしてInstagram送信用Blobに変換
 * ファイル名は非ASCIIだと添付アップロードに失敗するためASCII名へ振り直す
 * @param files Slackファイル配列
 * @param instagramUserId Instagram送信者ID（ファイル名生成用）
 * @returns ダウンロード済みメディア配列とエラー情報
 */
const processSlackFiles = (
  files: SlackFile[],
  instagramUserId: string,
): { media: DownloadedMedia[]; errors: string[] } => {
  const media: DownloadedMedia[] = [];
  const errors: string[] = [];

  files.forEach((file, index) => {
    const url = file.url_private_download;
    if (!url) {
      errors.push(`File ${index}: No download URL found`);
      return;
    }

    // メディアタイプを判定
    const mediaType = getInstagramMediaType(file.mimetype);
    if (!mediaType) {
      errors.push(`File ${index}: Unsupported media type (${file.mimetype})`);
      return;
    }

    // Slackからダウンロード
    const downloadResult = downloadFromSlack(url);
    if (!downloadResult.success || !downloadResult.blob) {
      errors.push(`File ${index}: Download failed - ${downloadResult.error}`);
      return;
    }

    // MIMEタイプを明示的に設定（Slackの情報を優先）し、ASCIIファイル名を付与
    const fileName = generateFileName(instagramUserId, file.mimetype, index);
    downloadResult.blob.setContentType(file.mimetype);
    downloadResult.blob.setName(fileName);

    media.push({ type: mediaType as MediaType, blob: downloadResult.blob });
  });

  return { media, errors };
};

/**
 * メディアをInstagramへアップロードして送信（認証エラー時はトークン更新して再試行）
 * @param recipientId 送信先ID
 * @param media 送信対象メディア
 * @returns 送信結果
 */
const sendMediaWithRetry = (
  recipientId: string,
  media: DownloadedMedia,
): { success: boolean; error?: string } => {
  // アップロード→送信を1回分の試行としてまとめる
  const attempt = (): {
    success: boolean;
    isAuthError?: boolean;
    error?: string;
  } => {
    const uploadResult = uploadInstagramAttachment(media.blob, media.type);
    if (!uploadResult.success || !uploadResult.attachmentId) {
      return {
        success: false,
        isAuthError: uploadResult.isAuthError,
        error: uploadResult.error,
      };
    }
    return sendInstagramDmWithAttachmentId(
      recipientId,
      uploadResult.attachmentId,
      media.type,
    );
  };

  let result = attempt();

  if (!result.success && result.isAuthError) {
    logWarn("Auth error detected during media send, refreshing token");
    const tokenRefreshResult = refreshToken();
    if (tokenRefreshResult.success) {
      logInfo("Token refreshed successfully, retrying media send");
      result = attempt();
    }
  }

  return { success: result.success, error: result.error };
};

/**
 * Slackスレッド返信からInstagram DMを送信（メディア対応版）
 * @param e DoPostイベント
 * @returns TextOutput(JSON)
 */
export const handleSlackReply = (
  e: GoogleAppsScript.Events.DoPost,
): TextOutput => {
  try {
    const payload = e.postData.contents;
    logInfo("Slack reply event received");

    // 0. 重複検出（Slackリトライ対策）
    const parsedPayload: SlackEventPayload = JSON.parse(payload);
    const eventId = parsedPayload.event_id;

    if (isDuplicateEvent(eventId)) {
      return json({ success: true, message: "Duplicate event skipped" });
    }
    markEventAsProcessed(eventId);

    // 1. Slack Eventペイロード解析
    const parseResult = parseSlackEvent(payload);

    if (!parseResult.success) {
      // スキップケース（スレッド返信でない等）
      if (parseResult.reason === "skip") {
        logWarn("Slack event skipped", { reason: parseResult.error });
        return json({ success: true, message: "Event skipped" });
      }

      // 解析エラー
      logError("Slack event parse failed", parseResult.error);
      const errorResult: ReplyResult = {
        success: false,
        status: "error_parse",
        error: parseResult.error,
        details: parseResult.error,
      };
      sendErrorNotification(
        "Slack返信解析失敗",
        parseResult.error ?? "Unknown error",
      );
      writeReplyLog(errorResult);
      return json({ success: false, error: parseResult.error });
    }

    const { channel, threadTs, messageTs, replyText, files } = parseResult.data;

    // 2. Slack APIで親メッセージ取得
    const parentResult = getParentMessage(channel, threadTs);

    if (!parentResult.success) {
      logError("Failed to get parent message", parentResult.error);
      const errorResult: ReplyResult = {
        success: false,
        replyText,
        status: "error_slack_api",
        error: parentResult.error,
        details: parentResult.error,
      };
      sendErrorNotification(
        "Slack親メッセージ取得失敗",
        parentResult.error ?? "Unknown error",
      );
      writeReplyLog(errorResult);
      return json({ success: false, error: parentResult.error });
    }

    // 3. 親メッセージからInstagram送信者IDを抽出
    const instagramUserId = extractInstagramUserId(parentResult.data.text);

    if (!instagramUserId) {
      logWarn("Instagram user ID not found in parent message");
      const errorResult: ReplyResult = {
        success: false,
        replyText,
        status: "error_parse",
        error: "Instagram user ID not found in parent message",
        details: "Could not extract Instagram user ID from thread parent",
      };
      sendErrorNotification(
        "Instagram送信者ID抽出失敗",
        "親メッセージから送信者IDを取得できませんでした",
      );
      writeReplyLog(errorResult);
      return json({ success: false, error: "Instagram user ID not found" });
    }

    // 4. メディア処理（ファイルがある場合）
    let downloadedMedia: DownloadedMedia[] = [];
    let mediaErrors: string[] = [];
    const mediaSendErrors: string[] = [];

    if (files && files.length > 0) {
      logInfo("Processing Slack files", { count: files.length });
      const mediaResult = processSlackFiles(files, instagramUserId);
      downloadedMedia = mediaResult.media;
      mediaErrors = mediaResult.errors;

      if (mediaErrors.length > 0) {
        logWarn("Some media processing failed", { errors: mediaErrors });
      }

      // メディアをInstagramにアップロード＆送信
      for (const media of downloadedMedia) {
        const sendResult = sendMediaWithRetry(instagramUserId, media);
        if (!sendResult.success) {
          mediaSendErrors.push(`${media.type}: ${sendResult.error}`);
        }
      }
    }

    // 5. テキストメッセージがある場合はInstagram DMを送信
    const hasText = replyText && replyText.trim().length > 0;
    let textSendSuccess = true;
    let textSendError: string | undefined;

    if (hasText) {
      let sendResult = sendInstagramDm(instagramUserId, replyText);

      // 認証エラーの場合、トークン更新して再試行
      if (!sendResult.success && sendResult.isAuthError) {
        logWarn("Auth error detected, refreshing token");
        const tokenRefreshResult = refreshToken();

        if (!tokenRefreshResult.success) {
          logError("Token refresh failed", tokenRefreshResult.error);
          const errorResult: ReplyResult = {
            success: false,
            instagramUserId,
            replyText,
            status: "error_instagram_api",
            error: "Token refresh failed",
            details: tokenRefreshResult.error,
          };
          sendErrorNotification(
            "トークン更新失敗",
            tokenRefreshResult.error ?? "Unknown error",
          );
          writeReplyLog(errorResult);
          return json({ success: false, error: tokenRefreshResult.error });
        }

        // トークン更新成功、再試行
        logInfo("Token refreshed successfully, retrying sendInstagramDm");
        sendResult = sendInstagramDm(instagramUserId, replyText);
      }

      if (!sendResult.success) {
        textSendSuccess = false;
        textSendError = sendResult.error;
      }
    }

    // 6. 結果判定
    const allMediaSuccess =
      mediaSendErrors.length === 0 && mediaErrors.length === 0;
    const hasMedia = downloadedMedia.length > 0;
    const overallSuccess =
      textSendSuccess && (hasMedia ? allMediaSuccess : true);
    const isPartialSuccess =
      !overallSuccess &&
      (textSendSuccess || mediaSendErrors.length < downloadedMedia.length);

    // テキスト送信も失敗し、メディアも全て失敗の場合
    if (
      !textSendSuccess &&
      (!hasMedia || mediaSendErrors.length === downloadedMedia.length)
    ) {
      logError("All sends failed", {
        textError: textSendError,
        mediaErrors: mediaSendErrors,
      });
      const errorResult: ReplyResult = {
        success: false,
        instagramUserId,
        replyText,
        status: "error_instagram_api",
        error: textSendError ?? "All media sends failed",
        details: [textSendError, ...mediaErrors, ...mediaSendErrors]
          .filter(Boolean)
          .join(", "),
      };
      sendErrorNotification(
        "Instagram DM送信失敗",
        textSendError ?? "All sends failed",
      );
      writeReplyLog(errorResult);
      return json({ success: false, error: textSendError });
    }

    // 7. 成功時リアクション追加
    addReaction(channel, messageTs, SUCCESS_EMOJI);

    // 8. 成功ログ出力
    const allErrors = [...mediaErrors, ...mediaSendErrors];

    const successResult: ReplyResult = {
      success: true,
      instagramUserId,
      replyText,
      status: isPartialSuccess ? "partial_success" : "success",
      details: isPartialSuccess
        ? `Reply sent with ${allErrors.length} error(s): ${allErrors.join(", ")}`
        : "Reply successfully sent to Instagram DM",
    };
    writeReplyLog(successResult);

    logInfo("Slack reply successfully sent to Instagram DM", {
      instagramUserId,
      mediaCount: downloadedMedia.length,
      isPartialSuccess,
    });

    return json({ success: true });
  } catch (err) {
    logError("Unexpected error in handleSlackReply", err);
    sendErrorNotification(
      "予期しないエラー（Slack返信処理）",
      err instanceof Error ? err.message : String(err),
    );
    return json({ success: false, error: String(err) });
  }
};
