import type { Agency, AttachmentFile, SendResult } from "../types";
import { SENDER_NAME, LINE_BOT_TOKEN } from "../env";

/**
 * 差分情報を文字列に整形
 * @param diffs 差分情報の配列
 * @returns 整形された差分サマリー
 */
const formatDiffSummary = (diffs: AttachmentFile["diffs"]): string => {
  if (diffs.length === 0) {
    return "変更なし";
  }

  return diffs
    .map((diff) => {
      if (diff.changeType === "new") {
        // 新規追加の場合
        return `新規追加 ${diff.rowNumber}行: ${diff.value}`;
      }
      // 更新の場合
      const changedColumns =
        diff.changedColumnNames && diff.changedColumnNames.length > 0
          ? `　更新列: ${diff.changedColumnNames.join(", ")}`
          : "";
      return `更新 ${diff.rowNumber}行: ${diff.value}${changedColumns}`;
    })
    .join("\n");
};

/**
 * Gmailでメッセージを送信
 * @param agency 代理店情報
 * @param subject 件名
 * @param body 本文
 * @param attachment 添付ファイル情報
 * @returns 送信結果
 */
const sendViaGmail = (
  agency: Agency,
  subject: string,
  body: string,
  attachment: AttachmentFile,
): SendResult => {
  try {
    const diffSummary = formatDiffSummary(attachment.diffs);
    const fullBody = `${body}\n\n【添付ファイル】\n${attachment.url}\n\n【更新内容】\n${diffSummary}`;

    const options: GoogleAppsScript.Gmail.GmailAdvancedOptions = {
      name: SENDER_NAME,
    };

    // CCアドレスがある場合は追加
    if (agency.ccAddresses && agency.ccAddresses.length > 0) {
      options.cc = agency.ccAddresses.join(",");
    }

    GmailApp.sendEmail(
      agency.toAddresses.join(","),
      subject,
      fullBody,
      options,
    );

    return {
      success: true,
      agency,
      timestamp: new Date(),
      attachmentFileId: attachment.file.getId(),
      diffSummary,
    };
  } catch (error) {
    return {
      success: false,
      agency,
      timestamp: new Date(),
      errorMessage: `Gmail送信エラー: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * LINEでメッセージを送信
 * @param agency 代理店情報
 * @param subject 件名
 * @param body 本文
 * @param attachment 添付ファイル情報
 * @returns 送信結果
 */
const sendViaLINE = (
  agency: Agency,
  subject: string,
  body: string,
  attachment: AttachmentFile,
): SendResult => {
  try {
    if (!agency.roomId) {
      throw new Error("LINEルームIDが設定されていません");
    }

    const diffSummary = formatDiffSummary(attachment.diffs);
    const message = `【${subject}】\n\n${body}\n\n【進捗報告書URL】\n${attachment.url}\n\n【更新内容】\n${diffSummary}`;

    // LINE Messaging APIを使用して送信
    if (!LINE_BOT_TOKEN) {
      throw new Error("LINE_BOT_TOKENが設定されていません");
    }

    const url = "https://api.line.me/v2/bot/message/push";
    const payload = {
      to: agency.roomId,
      messages: [
        {
          type: "text",
          text: message,
        },
      ],
    };

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_BOT_TOKEN}`,
      },
      payload: JSON.stringify(payload),
    };

    UrlFetchApp.fetch(url, options);

    return {
      success: true,
      agency,
      timestamp: new Date(),
      attachmentFileId: attachment.file.getId(),
      diffSummary,
    };
  } catch (error) {
    return {
      success: false,
      agency,
      timestamp: new Date(),
      errorMessage: `LINE送信エラー: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Google Chatでメッセージを送信
 * @param agency 代理店情報
 * @param subject 件名
 * @param body 本文
 * @param attachment 添付ファイル情報
 * @returns 送信結果
 */
const sendViaGoogleChat = (
  agency: Agency,
  subject: string,
  body: string,
  attachment: AttachmentFile,
): SendResult => {
  try {
    if (!agency.roomId) {
      throw new Error("Google ChatのWebhook URLが設定されていません");
    }

    const diffSummary = formatDiffSummary(attachment.diffs);
    const message = {
      text: `*${subject}*\n\n${body}\n\n*添付ファイル*\n${attachment.url}\n\n*更新内容*\n${diffSummary}`,
    };

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      payload: JSON.stringify(message),
    };

    UrlFetchApp.fetch(agency.roomId, options);

    return {
      success: true,
      agency,
      timestamp: new Date(),
      attachmentFileId: attachment.file.getId(),
      diffSummary,
    };
  } catch (error) {
    return {
      success: false,
      agency,
      timestamp: new Date(),
      errorMessage: `Google Chat送信エラー: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * プラットフォームに応じてメッセージを送信
 * @param agency 代理店情報
 * @param subject 件名
 * @param body 本文
 * @param attachment 添付ファイル情報
 * @returns 送信結果
 */
export const sendMessage = (
  agency: Agency,
  subject: string,
  body: string,
  attachment: AttachmentFile,
): SendResult => {
  switch (agency.platform) {
    case "Gmail":
      return sendViaGmail(agency, subject, body, attachment);
    case "LINE":
      return sendViaLINE(agency, subject, body, attachment);
    case "GoogleChat":
      return sendViaGoogleChat(agency, subject, body, attachment);
    default:
      return {
        success: false,
        agency,
        timestamp: new Date(),
        errorMessage: `未対応の送信媒体: ${agency.platform}`,
      };
  }
};
