/**
 * Dify通知
 * 記事処理結果をDifyワークフローに送信
 */

import { getDifyConfig } from "../env";
import { logInfo, logError } from "../utils/logger";
import type { ArticleProcessResult } from "../types";

/**
 * 全記事の処理結果をDifyに通知
 * 著者ごとのDifyワークフローに全員分の結果をBroadcast
 * @param results 全記事の処理結果
 */
export const notifyResults = (results: ArticleProcessResult[]): void => {
  if (results.length === 0) {
    logInfo("通知対象の記事が0件のためDify通知をスキップします");
    return;
  }

  // ユニークな著者リストを取得
  const uniqueAuthors = [
    ...new Set(results.map((result) => result.author)),
  ];

  logInfo(`Dify通知開始: ${uniqueAuthors.length}人の著者に通知`, {
    authors: uniqueAuthors,
    totalResults: results.length,
  });

  // 各著者のDifyワークフローに全員分の結果を送信
  for (const author of uniqueAuthors) {
    try {
      sendToDify(author, results);
    } catch (error) {
      logError(`Dify通知失敗: ${author}`, error);
    }
  }

  logInfo("Dify通知完了");
};

/**
 * 特定著者のDifyワークフローに通知を送信
 * @param authorName 著者名
 * @param results 全記事の処理結果
 */
const sendToDify = (
  authorName: string,
  results: ArticleProcessResult[],
): void => {
  const difyConfig = getDifyConfig(authorName);

  const requestBody = {
    inputs: {
      results: JSON.stringify(results),
    },
    response_mode: "blocking",
    user: authorName,
  };

  logInfo(`Dify通知送信中: ${authorName}`, {
    endpoint: difyConfig.endpointUrl,
    resultsCount: results.length,
  });

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${difyConfig.apiKey}`,
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(difyConfig.endpointUrl, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200 && statusCode !== 201) {
    const errorBody = response.getContentText();
    logError(`Dify通知失敗: ${authorName}`, {
      statusCode,
      errorBody,
    });
    throw new Error(
      `Dify通知に失敗しました: ${authorName} (HTTP ${statusCode})`,
    );
  }

  logInfo(`Dify通知成功: ${authorName}`);
};
