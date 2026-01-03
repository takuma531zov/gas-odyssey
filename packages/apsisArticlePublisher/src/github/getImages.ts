/**
 * GitHubから画像ファイルを取得
 */

import {
  GITHUB_REPO_URL,
  GITHUB_BRANCH_NAME,
  GITHUB_ARTICLE_PATH,
  GITHUB_ACCESS_TOKEN,
} from "../env";
import { logInfo, logWarn, logError } from "../utils/logger";
import type { GitHubFile, ImageFile } from "../types";

/**
 * GitHubリポジトリURLからowner/repo部分を抽出
 */
const parseRepoUrl = (repoUrl: string): string => {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+?)(\.git)?$/);
  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }
  return match[1];
};

/**
 * GitHubから画像ファイルを取得
 * パス: /{GITHUB_ARTICLE_PATH}/{title}/images/
 * @param title 記事タイトル
 * @returns 画像ファイルの配列
 */
export const getImages = (title: string): ImageFile[] => {
  const ownerRepo = parseRepoUrl(GITHUB_REPO_URL);
  const dirPath = `${GITHUB_ARTICLE_PATH}/${title}/images`;

  // GitHub Contents API URL（ディレクトリ取得）
  const apiUrl = `https://api.github.com/repos/${ownerRepo}/contents/${dirPath}?ref=${GITHUB_BRANCH_NAME}`;

  logInfo(`GitHubから画像フォルダを取得中: ${dirPath}`);

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    headers: {
      Authorization: `Bearer ${GITHUB_ACCESS_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const statusCode = response.getResponseCode();

  if (statusCode === 404) {
    logWarn(`画像フォルダが見つかりません: ${dirPath}`);
    return [];
  }

  if (statusCode !== 200) {
    const errorBody = response.getContentText();
    logError(`GitHub画像フォルダ取得失敗: ${dirPath}`, {
      statusCode,
      errorBody,
    });
    throw new Error(
      `GitHubから画像フォルダを取得できませんでした: ${dirPath} (HTTP ${statusCode})`,
    );
  }

  const files: GitHubFile[] = JSON.parse(response.getContentText());
  const imageFiles: ImageFile[] = [];

  // 各ファイルを取得
  for (const file of files) {
    if (file.type !== "file") {
      continue; // ディレクトリはスキップ
    }

    try {
      // download_urlを使って直接ダウンロード（認証不要、サイズ制限なし）
      if (!file.download_url) {
        logWarn(`download_urlが見つかりません: ${file.name}`);
        continue;
      }

      logInfo(`画像ファイルをダウンロード中: ${file.name} (${file.size} bytes)`);

      const downloadResponse = UrlFetchApp.fetch(file.download_url);
      const downloadStatusCode = downloadResponse.getResponseCode();

      if (downloadStatusCode !== 200) {
        logWarn(`画像ファイルダウンロード失敗: ${file.name}`, {
          statusCode: downloadStatusCode,
        });
        continue;
      }

      // Blobとして取得
      const blob = downloadResponse.getBlob();
      blob.setName(file.name);

      imageFiles.push({
        filename: file.name,
        blob: blob,
      });

      logInfo(`画像ファイルを取得しました: ${file.name}`);
    } catch (error) {
      logError(`画像ファイル取得中にエラー: ${file.name}`, error);
    }
  }

  logInfo(`${imageFiles.length}件の画像ファイルを取得しました`);

  return imageFiles;
};
