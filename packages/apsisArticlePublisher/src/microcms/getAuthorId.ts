/**
 * 著者ID取得
 * microCMSから著者名（member_name）でIDを取得
 */

import { MICRO_CMS_ENDPOINT_URL, MICRO_CMS_API_KEY } from "../env";
import { MICROCMS_ENDPOINTS } from "../constants";
import { logInfo, logError } from "../utils/logger";
import type { MicroCMSAuthor, MicroCMSListResponse } from "../types";

/**
 * 著者IDを取得
 * @param authorName 著者名（member_name）
 * @returns 著者ID
 */
export const getAuthorId = (authorName: string): string => {
  const apiUrl = `${MICRO_CMS_ENDPOINT_URL}${MICROCMS_ENDPOINTS.PROFILE}`;

  logInfo(`著者IDを取得中: ${authorName}`);

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    headers: {
      "X-MICROCMS-API-KEY": MICRO_CMS_API_KEY,
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    const errorBody = response.getContentText();
    logError(`著者マスタ取得失敗`, { statusCode, errorBody });
    throw new Error(
      `著者マスタを取得できませんでした (HTTP ${statusCode})`,
    );
  }

  const data: MicroCMSListResponse<MicroCMSAuthor> = JSON.parse(
    response.getContentText(),
  );

  // 著者名で検索
  const author = data.contents.find((a) => a.member_name === authorName);

  if (!author) {
    logError(`著者が見つかりません: ${authorName}`, {
      availableAuthors: data.contents.map((a) => a.member_name),
    });
    throw new Error(`著者が見つかりません: ${authorName}`);
  }

  logInfo(`著者IDを取得しました: ${authorName} → ${author.id}`);

  return author.id;
};
