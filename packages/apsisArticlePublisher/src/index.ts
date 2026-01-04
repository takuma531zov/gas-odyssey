/**
 * Apsis記事自動投稿システム
 * GASエントリーポイント
 */

import { processArticles } from "./processArticles";

/**
 * メイン処理
 * 明日投稿予定のApsis記事をGitHubから取得してmicroCMSに下書き保存
 */
function publishArticlesToMicroCMS(): void {
  processArticles();
}

// GASのエントリーポイントとして公開

declare const global: {
  [x: string]: unknown;
};

global.publishArticlesToMicroCMS = publishArticlesToMicroCMS;
