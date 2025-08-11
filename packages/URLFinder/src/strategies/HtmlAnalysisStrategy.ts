/**
 * Step2: ホームページHTML解析によるフォールバック検索
 * 目的: Step1失敗時のNavigation/Footer解析
 * 対象: Navigation内のcontactリンク検出
 */

import { ContactPageResult, SearchStrategy, HtmlSearchResult } from '../types/interfaces';
import { Environment } from '../env';
import { NetworkUtils } from '../utils/NetworkUtils';
import { UrlUtils } from '../utils/UrlUtils';
import { FormDetector } from '../detectors/FormDetector';
import { KeywordMatcher } from '../detectors/KeywordMatcher';

export class HtmlAnalysisStrategy implements SearchStrategy {

  /**
   * 戦略名を取得
   */
  getStrategyName(): string {
    return 'HTML Analysis Strategy (Step2)';
  }

  /**
   * HTML解析検索の実行
   */
  search(baseUrl: string): ContactPageResult | null {
    console.log(`=== ${this.getStrategyName()} Starting ===`);
    
    try {
      // ホームページのHTMLを取得
      const response = NetworkUtils.fetchWithTimeout(baseUrl, 7000);
      if (response.getResponseCode() !== 200) {
        console.log(`❌ Homepage not accessible: ${response.getResponseCode()}`);
        return null;
      }

      const html = response.getContentText();
      console.log(`✅ Homepage HTML loaded, size: ${html.length} characters`);

      return HtmlAnalysisStrategy.analyzeHtmlContent(html, baseUrl);

    } catch (error) {
      const detailedError = NetworkUtils.getDetailedNetworkError(error);
      console.log(`❌ Step2 failed: ${detailedError}`);
      return null;
    }
  }

  /**
   * HTML内容の解析
   */
  private static analyzeHtmlContent(html: string, baseUrl: string): ContactPageResult | null {
    console.log('=== Step2: HTML Content Analysis ===');

    // 1. Google Forms 最優先検索
    const googleFormUrls = this.findGoogleFormUrls(html);
    if (googleFormUrls) {
      console.log(`✅ Step2 Google Forms found: ${googleFormUrls}`);
      return {
        contactUrl: googleFormUrls,
        actualFormUrl: googleFormUrls,
        foundKeywords: ['step2_google_forms'],
        searchMethod: 'step2_google_forms'
      };
    }

    // 2. 埋め込みフォーム検証
    const embeddedFormResult = FormDetector.detectAnyForm(html);
    if (embeddedFormResult.found && embeddedFormResult.formType === 'embedded') {
      console.log(`✅ Step2 embedded form found`);
      return {
        contactUrl: embeddedFormResult.formUrl || baseUrl,
        actualFormUrl: embeddedFormResult.formUrl || baseUrl,
        foundKeywords: ['step2_embedded_form', embeddedFormResult.formType],
        searchMethod: 'step2_embedded_form'
      };
    }

    // 3. ナビゲーション内のリンク検索
    const navResult = this.searchInNavigation(html, baseUrl);
    if (navResult.url) {
      console.log(`✅ Step2 navigation link found: ${navResult.url}`);
      
      try {
        // 見つかったリンク先を検証
        const response = NetworkUtils.fetchWithTimeout(navResult.url, 5000);
        if (response.getResponseCode() === 200) {
          const candidateHtml = response.getContentText();
          
          // リンク先でフォーム検証
          const formResult = FormDetector.detectAnyForm(candidateHtml);
          if (formResult.found) {
            return {
              contactUrl: navResult.url,
              actualFormUrl: formResult.formUrl || navResult.url,
              foundKeywords: [...navResult.keywords, formResult.formType, `score_${navResult.score}`],
              searchMethod: 'step2_navigation_link'
            };
          }
        }
      } catch (error) {
        console.log(`Error validating navigation link ${navResult.url}: ${NetworkUtils.getDetailedNetworkError(error)}`);
      }
    }

    console.log('❌ Step2 analysis completed - no contact page found');
    return null;
  }

  /**
   * Google Forms URLの検出（HTML解析版）
   */
  private static findGoogleFormUrls(html: string): string | null {
    const formResult = FormDetector.detectAnyForm(html);
    if (formResult.found && formResult.formType === 'google_forms' && formResult.formUrl) {
      return formResult.formUrl;
    }
    return null;
  }

  /**
   * ナビゲーション検索
   * 唯一使用されているHTML検索処理
   */
  private static searchInNavigation(html: string, baseUrl: string): HtmlSearchResult {
    const navigationSelectors = [
      // 標準的なナビゲーション
      /<nav[\s\S]*?<\/nav>/gi,
      // ナビゲーション系のクラス/ID
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:nav|navigation|menu|header-menu|main-menu|primary-menu)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi,
      // ヘッダー内のリスト
      /<header[^>]*>[\s\S]*?<ul[^>]*>[\s\S]*?<\/ul>[\s\S]*?<\/header>/gi,
      // トップメニュー系
      /<[^>]*(?:class|id)=['"]*[^'" ]*(?:top-menu|global-nav|site-nav)[^'" ]*['"][^>]*>[\s\S]*?<\/[^>]+>/gi
    ];

    console.log('Searching in navigation with comprehensive selectors...');

    for (const regex of navigationSelectors) {
      const matches = html.match(regex) || [];
      console.log(`Found ${matches.length} matches for navigation selector`);

      for (const match of matches) {
        const result = this.extractContactLinks(match, baseUrl, 'navigation');
        if (result.url && result.score > 0) {
          console.log(`Navigation search found: ${result.url} (score: ${result.score})`);
          return result;
        }
      }
    }

    return { 
      url: null, 
      keywords: [], 
      score: 0, 
      context: 'navigation',
      reasons: [], 
      linkText: '' 
    };
  }

  /**
   * HTML内容からcontactリンクを抽出
   */
  private static extractContactLinks(content: string, baseUrl: string, contextType: string): HtmlSearchResult {
    const candidates: Array<{ 
      url: string, 
      keywords: string[], 
      score: number, 
      reasons: string[], 
      linkText: string 
    }> = [];
    
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

      // Skip non-web URLs
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
        continue;
      }

      // Calculate contact purity score
      const purityResult = KeywordMatcher.calculateContactPurity(url, cleanLinkText);
      let totalScore = purityResult.score;
      let allReasons = [...purityResult.reasons];

      // Context bonus
      if (contextType === 'navigation') {
        totalScore += 5;
        allReasons.push('navigation_context_bonus');
      }

      // Convert to absolute URL if needed
      const fullUrl = UrlUtils.resolveUrl(url, baseUrl);

      // Early termination for high confidence candidates
      if (totalScore >= Environment.getHighConfidenceThreshold()) {
        console.log(`✅ HIGH CONFIDENCE contact link found: ${fullUrl} (score: ${totalScore}) - terminating search early`);
        return {
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          context: contextType as any,
          reasons: allReasons,
          linkText: cleanLinkText
        };
      }

      // Add to candidates if score is reasonable
      if (totalScore > 0) {
        candidates.push({
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          reasons: allReasons,
          linkText: cleanLinkText
        });
      }
    }

    console.log(`Processed ${linksProcessed} links, found ${candidates.length} candidates`);

    if (candidates.length === 0) {
      return { 
        url: null, 
        keywords: [], 
        score: 0, 
        context: contextType as any,
        reasons: [], 
        linkText: '' 
      };
    }

    // Sort by score and return the best candidate
    candidates.sort((a, b) => b.score - a.score);
    const bestCandidate = candidates[0];

    if (!bestCandidate) {
      return { 
        url: null, 
        keywords: [], 
        score: 0, 
        context: contextType as any,
        reasons: [], 
        linkText: '' 
      };
    }

    console.log(`Best contact link candidate: ${bestCandidate.url} (score: ${bestCandidate.score})`);
    
    return {
      url: bestCandidate.url,
      keywords: bestCandidate.keywords,
      score: bestCandidate.score,
      context: contextType as any,
      reasons: bestCandidate.reasons,
      linkText: bestCandidate.linkText
    };
  }
}