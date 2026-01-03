/**
 * GitHubからマークダウンファイルを取得
 */

import {
  GITHUB_REPO_URL,
  GITHUB_BRANCH_NAME,
  GITHUB_ARTICLE_PATH,
  GITHUB_ACCESS_TOKEN,
} from "../env";
import { logInfo, logError } from "../utils/logger";
import type { GitHubFile } from "../types";

/**
 * GitHubリポジトリURLからowner/repo部分を抽出
 * @param repoUrl GitHubリポジトリURL
 * @returns {owner}/{repo}
 */
const parseRepoUrl = (repoUrl: string): string => {
  // https://github.com/owner/repo または https://github.com/owner/repo.git
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+?)(\.git)?$/);
  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }
  return match[1];
};

/**
 * GitHubからマークダウンファイルを取得
 * パス: /{GITHUB_ARTICLE_PATH}/{title}/{title}.md
 * @param title 記事タイトル
 * @returns マークダウン文字列
 */
export const getMarkdownFile = (title: string): string => {
  const ownerRepo = parseRepoUrl(GITHUB_REPO_URL);
  const filePath = `${GITHUB_ARTICLE_PATH}/${title}/${title}.md`;

  // GitHub Contents API URL
  const apiUrl = `https://api.github.com/repos/${ownerRepo}/contents/${filePath}?ref=${GITHUB_BRANCH_NAME}`;

  logInfo(`GitHubからマークダウンファイルを取得中: ${filePath}`);

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

  if (statusCode !== 200) {
    const errorBody = response.getContentText();
    logError(`GitHubファイル取得失敗: ${filePath}`, {
      statusCode,
      errorBody,
    });
    throw new Error(
      `GitHubからファイルを取得できませんでした: ${filePath} (HTTP ${statusCode})`,
    );
  }

  const fileData: GitHubFile = JSON.parse(response.getContentText());

  if (!fileData.content || !fileData.encoding) {
    throw new Error(`ファイルコンテンツが見つかりません: ${filePath}`);
  }

  // Base64デコード
  if (fileData.encoding !== "base64") {
    throw new Error(
      `サポートされていないエンコーディング: ${fileData.encoding}`,
    );
  }

  const decodedContent = Utilities.newBlob(
    Utilities.base64Decode(fileData.content),
  ).getDataAsString();

  logInfo(`マークダウンファイルを取得しました: ${filePath}`);

  return decodedContent;
};
