/**
 * マークダウン内の画像パス置換
 * ローカルファイル名をmicroCMS URLに置換
 */

import { logInfo, logWarn } from "../utils/logger";
import type { ImageUrlMap } from "../types";

/**
 * マークダウン内の画像パスをmicroCMS URLに置換
 * @param markdown マークダウン文字列
 * @param imageUrlMap ファイル名→URLマッピング
 * @returns 置換後のマークダウン
 */
export const replaceImagePaths = (
  markdown: string,
  imageUrlMap: ImageUrlMap,
): string => {
  let replacedMarkdown = markdown;
  let replacedCount = 0;

  // 画像記法を検索: ![alt](filename.png)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  replacedMarkdown = markdown.replace(imageRegex, (match, alt, filename) => {
    // ファイル名→URLマッピングから置換
    if (imageUrlMap[filename]) {
      replacedCount++;
      logInfo(`画像パスを置換: ${filename} → ${imageUrlMap[filename]}`);
      return `![${alt}](${imageUrlMap[filename]})`;
    }

    logWarn(`画像URLが見つかりません: ${filename}`, {
      availableImages: Object.keys(imageUrlMap),
    });
    return match; // 置換せずにそのまま返す
  });

  logInfo(`${replacedCount}件の画像パスを置換しました`);

  return replacedMarkdown;
};
