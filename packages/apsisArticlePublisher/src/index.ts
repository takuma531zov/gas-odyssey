/**
 * Apsis記事自動投稿システム
 * GASエントリーポイント
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

/**
 * microCMSサービスIDを取得
 * MICRO_CMS_ENDPOINT_URLから抽出
 */
const getMicroCMSServiceId = (): string => {
  // https://xxxxx.microcms.io/api/v1/ から "xxxxx" を抽出
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
 * メイン処理
 * 明日投稿予定のApsis記事をGitHubから取得してmicroCMSに下書き保存
 */
function publishArticlesToMicroCMS(): void {
  logInfo("=== Apsis記事自動下書き保存システム開始 ===");

  try {
    // 1. 対象記事を取得（明日 & Apsis & 投稿準備完了）
    const targetArticles = getTargetArticles();

    if (targetArticles.length === 0) {
      logInfo("対象記事が0件のため処理を終了します");
      return;
    }

    const serviceId = getMicroCMSServiceId();

    // 2. 各記事について処理
    for (const article of targetArticles) {
      logInfo(`記事処理開始: ${article.title}`);

      try {
        // 2-1. GitHubからマークダウンファイル取得
        const markdownContent = getMarkdownFile(article.title);

        // 2-2. フロントマター解析
        const { frontMatter, content } = parseFrontmatter(markdownContent);

        // 2-3. GitHubから画像ファイル取得
        const imageFiles = getImages(article.title);

        // 2-4. microCMSに画像アップロード
        const imageUrlMap = uploadImages(imageFiles, serviceId);

        // 2-5. 著者ID取得
        const authorId = getAuthorId(frontMatter.author);

        // 2-6. タグID配列取得
        const tagIds = getTagIds(frontMatter.tags);

        // 2-7. マークダウン内の画像パス置換
        const replacedContent = replaceImagePaths(content, imageUrlMap);
        logInfo("画像置換後のマークダウン（最初の500文字）", {
          preview: replacedContent.substring(0, 500),
        });

        // 2-8. マークダウンをHTMLに変換
        const htmlContent = markdownToHtml(replacedContent);
        logInfo("HTML変換後（最初の500文字）", {
          preview: htmlContent.substring(0, 500),
        });

        // 2-9. microCMSに記事を下書き保存
        publishArticle({
          title: frontMatter.title,
          author: authorId,
          content: htmlContent,
          tag: tagIds,
          read_time: [frontMatter.read_time],
          excerpt: frontMatter.excerpt,
        });

        // 2-10. ステータスを「投稿済み」に更新
        updateStatus(article.rowIndex, SHEET_STATUS.POSTED);

        logInfo(`記事処理完了: ${article.title}`);
      } catch (error) {
        // エラーログ出力
        logError(`記事処理失敗: ${article.title}`, error);

        // ステータスを「投稿失敗」に更新
        updateStatus(article.rowIndex, SHEET_STATUS.FAILED);
      }
    }

    logInfo("=== Apsis記事自動下書き保存システム完了 ===");
  } catch (error) {
    logError("致命的エラーが発生しました", error);
    throw error;
  }
}
