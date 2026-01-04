/**
 * 記事処理メインロジック
 * スプレッドシートから対象記事を取得し、GitHubからコンテンツ取得、microCMSに下書き保存
 */

import { SHEET_STATUS } from "./constants";
import { MICRO_CMS_ENDPOINT_URL } from "./env";
import { getTargetArticles, updateStatus } from "./spreadsheet";
import { getMarkdownFile, getImages, parseFrontmatter } from "./github";
import {
  getAuthorId,
  getTagIds,
  uploadImages,
  replaceImagePaths,
  publishArticle,
} from "./microcms";
import { markdownToHtml, logInfo, logError } from "./utils";
import { notifyResults } from "./dify";
import type { ArticleProcessResult } from "./types";

/**
 * microCMSサービスIDを取得
 * MICRO_CMS_ENDPOINT_URLから抽出
 */
const getMicroCMSServiceId = (): string => {
  const match = MICRO_CMS_ENDPOINT_URL.match(
    /https:\/\/([^.]+)\.microcms\.io/,
  );
  if (!match) {
    throw new Error(
      "MICRO_CMS_ENDPOINT_URLからサービスIDを抽出できません",
    );
  }
  return match[1];
};

/**
 * 1記事分の処理
 * GitHubからマークダウン・画像を取得し、microCMSに下書き保存
 */
const processSingleArticle = (
  article: { title: string; author: string },
  serviceId: string,
): void => {
  logInfo(`記事処理開始: ${article.title}`);

  // GitHub連携: マークダウンと画像を取得
  const markdownContent = getMarkdownFile(article.title, article.author);
  const { frontMatter, content } = parseFrontmatter(markdownContent);
  const imageFiles = getImages(article.title, article.author);

  // microCMS連携: 画像アップロードと著者・タグID取得
  const imageUrlMap = uploadImages(imageFiles, serviceId);
  const authorId = getAuthorId(frontMatter.author);
  const tagIds = getTagIds(frontMatter.tags);

  // コンテンツ変換: 画像パス置換とHTML変換
  const replacedContent = replaceImagePaths(content, imageUrlMap);

  logInfo("画像置換後のマークダウン（最初の500文字）", {
    preview: replacedContent.substring(0, 500),
  });

  const htmlContent = markdownToHtml(replacedContent);

  logInfo("HTML変換後（最初の500文字）", {
    preview: htmlContent.substring(0, 500),
  });

  // microCMS投稿: 記事を下書き保存
  publishArticle({
    title: frontMatter.title,
    author: authorId,
    content: htmlContent,
    tag: tagIds,
    read_time: [frontMatter.read_time],
    excerpt: frontMatter.excerpt,
  });

  logInfo(`記事処理完了: ${article.title}`);
};

/**
 * 全対象記事の処理
 * スプレッドシートから明日投稿予定の記事を取得し、順次処理してDifyに通知
 */
export const processArticles = (): void => {
  logInfo("=== Apsis記事自動下書き保存システム開始 ===");

  try {
    // スプレッドシートから対象記事を取得
    const targetArticles = getTargetArticles();

    // 対象記事が0件の場合は早期リターン
    if (targetArticles.length === 0) {
      logInfo("対象記事が0件のため処理を終了します");
      return;
    }

    // microCMSサービスIDを取得
    const serviceId = getMicroCMSServiceId();

    // 処理結果を格納する配列
    const processResults: ArticleProcessResult[] = [];

    // 各記事を順次処理
    for (const article of targetArticles) {
      try {
        // 1記事分の処理を実行（GitHub取得 → microCMS投稿）
        processSingleArticle(article, serviceId);

        // スプレッドシートのステータスを「投稿済み」に更新
        updateStatus(article.rowIndex, SHEET_STATUS.POSTED);

        // 成功結果を記録
        processResults.push({
          title: article.title,
          author: article.author,
          status: "success",
        });
      } catch (error) {
        logError(`記事処理失敗: ${article.title}`, error);

        // スプレッドシートのステータスを「失敗」に更新
        updateStatus(article.rowIndex, SHEET_STATUS.FAILED);

        // 失敗結果を記録
        processResults.push({
          title: article.title,
          author: article.author,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logInfo("=== Apsis記事自動下書き保存システム完了 ===");

    // 処理結果を各著者のDifyワークフローに通知
    notifyResults(processResults);
  } catch (error) {
    logError("致命的エラーが発生しました", error);
    throw error;
  }
};
