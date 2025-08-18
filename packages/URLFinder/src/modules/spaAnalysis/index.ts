/**
 * SPA・アンカー処理システムモジュール
 * Single Page Application の検出と解析を行う機能
 * 
 * 【処理内容】
 * - 同一HTMLパターン検出による SPA 判定
 * - SPA 内でのアンカーリンク解析
 * - アンカーセクション専用検索
 */

import type { ContactPageResult } from '../../types/interfaces';
import { UrlUtils } from '../../utils/UrlUtils';

/**
 * SPA解析実行
 * Single Page Applicationで検出されたアンカーリンクを解析
 * @param html SPA HTML内容
 * @param baseUrl ベースURL
 * @param searchInNavigation ナビゲーション検索関数
 * @param analyzeAnchorSection アンカーセクション解析関数
 * @returns SPA解析結果
 */
export function executeSPAAnalysis(
  html: string, 
  baseUrl: string,
  searchInNavigation: (html: string, baseUrl: string) => { url: string | null, keywords: string[], score: number, reasons: string[] },
  analyzeAnchorSection: (html: string, anchorUrl: string, baseUrl: string) => ContactPageResult
): ContactPageResult {
  try {
    console.log('Executing SPA analysis on detected single-page application');

    // Navigation search for anchor links in the current HTML
    const navResult = searchInNavigation(html, baseUrl);
    if (navResult.url && UrlUtils.isAnchorLink(navResult.url)) {
      console.log(`Anchor link found in SPA navigation: ${navResult.url}`);

      // Analyze the corresponding section in the same HTML
      const anchorSectionResult = analyzeAnchorSection(html, navResult.url, baseUrl);
      if (anchorSectionResult.contactUrl) {
        // Update search method to reflect SPA detection
        anchorSectionResult.searchMethod = 'spa_anchor_analysis';
        anchorSectionResult.foundKeywords.push('spa_detected');
        return anchorSectionResult;
      }
    }

    // No anchor contact links found in SPA
    console.log('SPA analysis completed but no suitable anchor contact found');
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['spa_detected', 'anchor_analysis_failed'],
      searchMethod: 'spa_analysis_failed'
    };
  } catch (error) {
    console.log(`Error in SPA analysis: ${error}`);
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ['spa_detected', 'spa_analysis_error'],
      searchMethod: 'spa_analysis_error'
    };
  }
}

/**
 * 同一HTMLパターンの検出
 * 複数URLが同じHTMLを返す場合SPAと判定
 * @param urls 検証対象URL群
 * @param htmlContent HTML内容
 * @param sameHtmlCache キャッシュオブジェクト（参照渡し）
 * @returns SPAの可能性がある場合true
 */
export function detectSameHtmlPattern(urls: string[], htmlContent: string, sameHtmlCache: { [url: string]: string }): boolean {
  const contentHash = UrlUtils.hashString(htmlContent);
  let sameCount = 0;

  for (const url of urls) {
    if (sameHtmlCache[url] === contentHash) {
      sameCount++;
    } else {
      sameHtmlCache[url] = contentHash;
    }
  }

  // 2つ以上のURLが同じHTMLを返す場合SPAと判定
  return sameCount >= 2;
}