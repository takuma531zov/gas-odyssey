import {
  getScriptPropertyValue,
  columnNameToNumber,
} from "../../common/src/spreadsheet";

// スクリプトプロパティ名
export const SCRIPT_PROPERTIES = {
  POSTING_DATE_COLUMN: "POSTING_DATE_COLUMN", //掲載日列
  AUTHOR_COLUMN: "AUTHOR_COLUMN", //著者列
  ARTICLE_TITLE_COLUMN: "ARTICLE_TITLE_COLUMN", //記事タイトル列
  PLATFORM_COLUMN: "PLATFORM_COLUMN", //媒体名列
  STATUS_COLUMN: "STATUS_COLUMN", //ステータス列
  BLOG_ARTICLE_LIST_SHEET_NAME: "BLOG_ARTICLE_LIST_SHEET_NAME", //ブログ記事リストシート名
  GITHUB_REPO_URL: "GITHUB_REPO_URL", //GitHubリポジトリURL
  GITHUB_BRANCH_NAME: "GITHUB_BRANCH_NAME", //GitHubブランチ名
  GITHUB_ARTICLE_PATH: "GITHUB_ARTICLE_PATH", //GitHub記事パス
  GITHUB_ACCESS_TOKEN: "GITHUB_ACCESS_TOKEN", //GitHubトークン
  MICRO_CMS_ENDPOINT_URL: "MICRO_CMS_ENDPOINT_URL", //microCMSエンドポイントURL
  MICRO_CMS_API_KEY: "MICRO_CMS_API_KEY", //microCMS APIキー
  DIFY_ENDPOINT_URL: "DIFY_ENDPOINT_URL", //Dify Webhook URL
  DIFY_API_KEY: "DIFY_API_KEY", //Dify APIキー
} as const;

// スクリプトプロパティの値を取得
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
export const BLOG_ARTICLE_LIST_SHEET_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.BLOG_ARTICLE_LIST_SHEET_NAME,
);
export const GITHUB_REPO_URL = getScriptPropertyValue(
  SCRIPT_PROPERTIES.GITHUB_REPO_URL,
);
export const GITHUB_BRANCH_NAME = getScriptPropertyValue(
  SCRIPT_PROPERTIES.GITHUB_BRANCH_NAME,
);
export const GITHUB_ARTICLE_PATH = getScriptPropertyValue(
  SCRIPT_PROPERTIES.GITHUB_ARTICLE_PATH,
);
export const GITHUB_ACCESS_TOKEN = getScriptPropertyValue(
  SCRIPT_PROPERTIES.GITHUB_ACCESS_TOKEN,
);
export const MICRO_CMS_ENDPOINT_URL = getScriptPropertyValue(
  SCRIPT_PROPERTIES.MICRO_CMS_ENDPOINT_URL,
);
export const MICRO_CMS_API_KEY = getScriptPropertyValue(
  SCRIPT_PROPERTIES.MICRO_CMS_API_KEY,
);
export const DIFY_ENDPOINT_URL = getScriptPropertyValue(
  SCRIPT_PROPERTIES.DIFY_ENDPOINT_URL,
);
export const DIFY_API_KEY = getScriptPropertyValue(
  SCRIPT_PROPERTIES.DIFY_API_KEY,
);
