/**
 * microCMS記事投稿
 * 記事を下書きとして保存（後で手動で公開開始予約を設定）
 */

import { MICRO_CMS_ENDPOINT_URL, MICRO_CMS_API_KEY } from "../env";
import { MICROCMS_ENDPOINTS } from "../constants";
import { logInfo, logError } from "../utils/logger";
import type { MicroCMSBlogPostRequest } from "../types";

/**
 * microCMSに記事を下書き投稿
 * @param request 記事投稿リクエスト
 * @returns 投稿成功したかどうか
 */
export const publishArticle = (
  request: Omit<MicroCMSBlogPostRequest, "status" | "publishedAt">,
): void => {
  // APIエンドポイント（status=draftで下書きとして保存）
  const apiUrl = `${MICRO_CMS_ENDPOINT_URL}${MICROCMS_ENDPOINTS.BLOGS}?status=draft`;

  // リクエストボディ（publishedAtは不要）
  const body = {
    ...request,
  };

  logInfo(`microCMSに記事を投稿中: ${request.title}`);

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "X-MICROCMS-API-KEY": MICRO_CMS_API_KEY,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200 && statusCode !== 201) {
    const errorBody = response.getContentText();
    logError(`記事投稿失敗: ${request.title}`, {
      statusCode,
      errorBody,
      request: body,
    });

    // エラー詳細をメッセージに含める
    let errorDetail = "";
    try {
      const errorJson = JSON.parse(errorBody);
      errorDetail = JSON.stringify(errorJson, null, 2);
    } catch {
      errorDetail = errorBody;
    }

    throw new Error(
      `記事を投稿できませんでした: ${request.title} (HTTP ${statusCode})\nエラー詳細: ${errorDetail}\nリクエスト: ${JSON.stringify(body, null, 2)}`,
    );
  }

  const responseData = JSON.parse(response.getContentText());

  logInfo(`記事を下書き保存しました: ${request.title}`, {
    id: responseData.id,
  });
};
