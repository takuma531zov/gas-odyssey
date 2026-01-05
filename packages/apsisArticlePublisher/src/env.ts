/**
 * 環境変数取得
 * スクリプトプロパティから環境変数を取得
 */

import {
  getScriptPropertyValue,
  columnNameToNumber,
} from "../../common/src/spreadsheet";

// スクリプトプロパティ名
export const SCRIPT_PROPERTIES = {
  // スプレッドシート列設定
  POSTING_DATE_COLUMN: "POSTING_DATE_COLUMN",
  AUTHOR_COLUMN: "AUTHOR_COLUMN",
  ARTICLE_TITLE_COLUMN: "ARTICLE_TITLE_COLUMN",
  PLATFORM_COLUMN: "PLATFORM_COLUMN",
  STATUS_COLUMN: "STATUS_COLUMN",
  TAGS_COLUMN: "TAGS_COLUMN",
  TAGS_CHECK_COLUMN: "TAGS_CHECK_COLUMN",
  BLOG_ARTICLE_LIST_SHEET_NAME: "BLOG_ARTICLE_LIST_SHEET_NAME",

  // microCMS設定（全ユーザー共通）
  MICRO_CMS_ENDPOINT_URL: "MICRO_CMS_ENDPOINT_URL",
  MICRO_CMS_API_KEY: "MICRO_CMS_API_KEY",
} as const;

// スプレッドシート列設定
export const POSTING_DATE_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.POSTING_DATE_COLUMN),
);
export const AUTHOR_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.AUTHOR_COLUMN),
);
export const ARTICLE_TITLE_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.ARTICLE_TITLE_COLUMN),
);
export const PLATFORM_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.PLATFORM_COLUMN),
);
export const STATUS_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.STATUS_COLUMN),
);
export const TAGS_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.TAGS_COLUMN),
);
export const TAGS_CHECK_COLUMN = columnNameToNumber(
  getScriptPropertyValue(SCRIPT_PROPERTIES.TAGS_CHECK_COLUMN),
);
export const BLOG_ARTICLE_LIST_SHEET_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.BLOG_ARTICLE_LIST_SHEET_NAME,
);

// microCMS設定（全ユーザー共通）
export const MICRO_CMS_ENDPOINT_URL = getScriptPropertyValue(
  SCRIPT_PROPERTIES.MICRO_CMS_ENDPOINT_URL,
);
export const MICRO_CMS_API_KEY = getScriptPropertyValue(
  SCRIPT_PROPERTIES.MICRO_CMS_API_KEY,
);

/**
 * 著者名からユーザー番号（サフィックス）を取得
 * @param authorName 著者名（スプレッドシートの値）
 * @returns ユーザー番号（例: "1", "2", "3"）
 * @throws 著者名が見つからない場合はエラー
 */
export const getAuthorUserNumber = (authorName: string): string => {
  // USER_1, USER_2, USER_3... と順に確認（最大10ユーザーまで対応）
  for (let i = 1; i <= 10; i++) {
    const userKey = `USER_${i}`;
    try {
      const userName = getScriptPropertyValue(userKey);
      if (userName === authorName) {
        return String(i);
      }
    } catch {
      // スクリプトプロパティが存在しない場合は終了
      break;
    }
  }

  throw new Error(
    `著者「${authorName}」に対応するユーザー設定が見つかりません。スクリプトプロパティでUSER_Xを設定してください。`,
  );
};

/**
 * 著者別のGitHub設定を取得
 * @param authorName 著者名
 * @returns GitHub設定
 */
export const getGitHubConfig = (
  authorName: string,
): {
  repoUrl: string;
  articlePath: string;
  branchName: string;
  accessToken: string;
} => {
  const userNumber = getAuthorUserNumber(authorName);

  return {
    repoUrl: getScriptPropertyValue(`GITHUB_REPO_URL_${userNumber}`),
    articlePath: getScriptPropertyValue(`GITHUB_ARTICLE_PATH_${userNumber}`),
    branchName: getScriptPropertyValue(`GITHUB_BRANCH_NAME_${userNumber}`),
    accessToken: getScriptPropertyValue(`GITHUB_ACCESS_TOKEN_${userNumber}`),
  };
};

/**
 * 著者別のDify設定を取得
 * @param authorName 著者名
 * @returns Dify設定
 */
export const getDifyConfig = (
  authorName: string,
): {
  endpointUrl: string;
  apiKey: string;
} => {
  const userNumber = getAuthorUserNumber(authorName);

  return {
    endpointUrl: getScriptPropertyValue(`DIFY_ENDPOINT_URL_${userNumber}`),
    apiKey: getScriptPropertyValue(`DIFY_API_KEY_${userNumber}`),
  };
};
