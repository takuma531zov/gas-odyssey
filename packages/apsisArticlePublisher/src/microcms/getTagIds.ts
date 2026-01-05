/**
 * タグID取得
 * microCMSからタグslug配列でID配列を取得
 */

import { MICRO_CMS_ENDPOINT_URL, MICRO_CMS_API_KEY } from "../env";
import { MICROCMS_ENDPOINTS } from "../constants";
import { logInfo, logWarn, logError } from "../utils/logger";
import type { MicroCMSTag, MicroCMSListResponse } from "../types";

/**
 * タグID配列を取得
 * @param tagSlugs タグslug配列（例: ["instagram", "ai"]）
 * @returns タグID配列
 */
export const getTagIds = (tagSlugs: string[]): string[] => {
  if (tagSlugs.length === 0) {
    logInfo("タグが指定されていません");
    return [];
  }

  const apiUrl = `${MICRO_CMS_ENDPOINT_URL}${MICROCMS_ENDPOINTS.TAGS}`;

  logInfo(`タグIDを取得中: ${tagSlugs.join(", ")}`);

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
    logError("タグマスタ取得失敗", { statusCode, errorBody });
    throw new Error(`タグマスタを取得できませんでした (HTTP ${statusCode})`);
  }

  const data: MicroCMSListResponse<MicroCMSTag> = JSON.parse(
    response.getContentText(),
  );

  const tagIds: string[] = [];

  // 各タグslugで検索
  for (const slug of tagSlugs) {
    const tag = data.contents.find((t) => t.slug === slug);

    if (tag) {
      tagIds.push(tag.id);
      logInfo(`タグIDを取得しました: ${slug} → ${tag.id}`);
    } else {
      logWarn(`タグが見つかりません: ${slug}`, {
        availableTags: data.contents.map((t) => t.slug),
      });
    }
  }

  if (tagIds.length === 0) {
    logWarn("有効なタグが1つも見つかりませんでした");
  }

  return tagIds;
};
