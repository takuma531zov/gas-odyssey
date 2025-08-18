/**
 * リンク抽出・解析システムモジュール
 * HTML内容から問い合わせ関連リンクを抽出・解析する機能
 * 
 * 【処理内容】
 * - 問い合わせリンク抽出・スコアリング
 * - コンテキスト別ボーナス計算
 * - 問い合わせ関連リンク存在チェック
 */

import { Environment } from '../../env';
import { UrlUtils } from '../../utils/UrlUtils';
import { HtmlAnalyzer } from '../../analyzers/HtmlAnalyzer';
import { CONTACT_LINK_KEYWORDS } from '../../constants/SearchConstants';

/**
 * 問い合わせリンク抽出
 * HTML内容から問い合わせ関連リンクを抽出・解析
 * @param content 解析対象HTML内容
 * @param baseUrl ベースURL
 * @param contextType コンテキストタイプ（general/navigation等）
 * @returns 抽出されたリンク情報
 */
export function extractContactLinks(content: string, baseUrl: string, contextType: string = 'general'): { url: string | null, keywords: string[], score: number, reasons: string[], linkText: string } {
  const candidates: Array<{ url: string, keywords: string[], score: number, reasons: string[], linkText: string }> = [];
  const linkRegex = /<a[^>]*href=['"]([^'\"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  let linksProcessed = 0;

  console.log(`Starting link extraction from HTML content (context: ${contextType})`);

  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[1];
    const linkText = match[2];
    linksProcessed++;

    if (!url || !linkText) continue;

    const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
    console.log(`Processing link ${linksProcessed}: "${cleanLinkText}" -> ${url}`);

    // Special debug for /contact/ links
    if (url.includes('/contact') || cleanLinkText.toLowerCase().includes('contact')) {
      console.log(`🎯 CONTACT LINK DETECTED: "${cleanLinkText}" -> ${url}`);
    }

    // Skip non-web URLs
    if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
      continue;
    }

    // Calculate contact purity score
    const purityResult = HtmlAnalyzer.calculateContactPurity(url, cleanLinkText);
    let totalScore = purityResult.score;
    let allReasons = [...purityResult.reasons];

    // Context bonus (expanded)
    if (contextType === 'navigation') {
      totalScore += 5;
      allReasons.push('navigation_context_bonus');
    } else if (contextType === 'footer') {
      totalScore += 3;
      allReasons.push('footer_context_bonus');
    } else if (contextType === 'sidebar') {
      totalScore += 2;
      allReasons.push('sidebar_context_bonus');
    } else if (contextType === 'mobile_menu') {
      totalScore += 4;
      allReasons.push('mobile_menu_context_bonus');
    }

    // Log all candidates for debugging (including negative scores)
    console.log(`Link candidate: "${cleanLinkText}" -> ${url} (score: ${totalScore}, reasons: ${allReasons.join(',')})`);

    // Only consider candidates with positive scores
    if (totalScore > 0) {
      const fullUrl = UrlUtils.resolveUrl(url, baseUrl);
      candidates.push({
        url: fullUrl,
        keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
        score: totalScore,
        reasons: allReasons,
        linkText: cleanLinkText
      });

      console.log(`✓ Contact link candidate: "${cleanLinkText}" -> ${fullUrl} (score: ${totalScore}, reasons: ${allReasons.join(',')})`);

      // Early termination for high confidence candidates
      if (totalScore >= Environment.getHighConfidenceThreshold()) {
        console.log(`✅ HIGH CONFIDENCE contact link found: ${fullUrl} (score: ${totalScore}) - terminating search early`);
        return {
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          reasons: allReasons,
          linkText: cleanLinkText
        };
      }
    } else {
      console.log(`✗ Link excluded: "${cleanLinkText}" -> ${url} (score: ${totalScore}, reasons: ${allReasons.join(',')})`);
    }
  }

  console.log(`Link extraction completed: processed ${linksProcessed} links, found ${candidates.length} candidates`);

  // Return best candidate if any
  if (candidates.length > 0) {
    const sortedCandidates = candidates.sort((a, b) => b.score - a.score);
    const bestCandidate = sortedCandidates[0];
    if (bestCandidate) {
      console.log(`Best candidate selected: ${bestCandidate.url} (score: ${bestCandidate.score})`);
      return {
        url: bestCandidate.url,
        keywords: bestCandidate.keywords,
        score: bestCandidate.score,
        reasons: bestCandidate.reasons,
        linkText: bestCandidate.linkText
      };
    }
  }

  return { url: null, keywords: [], score: 0, reasons: [], linkText: '' };
}

/**
 * 問い合わせ関連リンク存在チェック
 * ページ内に問い合わせ関連のリンクが存在するかチェック（BtoB営業用途特化）
 * @param html 検索対象HTML
 * @returns リンク存在情報とリンクテキスト配列
 */
export function hasContactRelatedLinks(html: string): { hasLinks: boolean, linkTexts: string[] } {

  const linkRegex = /<a[^>]*href=['"]([^'\"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const foundLinkTexts: string[] = [];

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const linkText = match[2];

    if (!url || !linkText) continue;

    // 無効なURLをスキップ
    if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) continue;

    const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const lowerUrl = url.toLowerCase();

    // URLまたはリンクテキストに問い合わせ関連キーワードが含まれているかチェック
    for (const keyword of CONTACT_LINK_KEYWORDS) {
      if (cleanLinkText.includes(keyword.toLowerCase()) || lowerUrl.includes(keyword.toLowerCase())) {
        foundLinkTexts.push(cleanLinkText || url);
        console.log(`Contact link found: "${cleanLinkText}" -> ${url}`);
        break; // 同じリンクで複数キーワードがマッチしても1回だけカウント
      }
    }
  }

  return {
    hasLinks: foundLinkTexts.length > 0,
    linkTexts: foundLinkTexts
  };
}