/**
 * Step2解析機能モジュール
 * ホームページHTML解析によるフォールバック検索
 * 
 * 【処理内容】
 * - ナビゲーション内リンク解析
 * - Google Forms検出・検証
 * - 実際のフォーム検証（リンク先確認）
 * - アンカーリンク特別処理
 */

import { ContactPageResult } from '../../types/interfaces';
import { UrlUtils } from '../../utils/UrlUtils';
import { FormAnalyzer } from '../../analyzers/FormAnalyzer';

// GAS専用インポート（ESBuildでは無視される）
declare const UrlFetchApp: any;

/**
 * Step2解析状態管理用インターフェース
 */
export interface Step2AnalysisState {
  successfulFormUrls: string[];
}

/**
 * ナビゲーション内リンク検索
 * 9つのセレクターでナビゲーション要素を検索し、問い合わせリンクを特定
 * @param html 解析対象HTML
 * @param baseUrl ベースURL
 * @returns 検索結果（URL、キーワード、スコア、理由）
 */
export function searchInNavigation(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
  // modules/step2Analysis/index.ts で実装
  const NAVIGATION_SELECTORS = [
    /<nav[\s\S]*?<\/nav>/gi,
    /<header[\s\S]*?<\/header>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
    /class=["'][^"']*menu[^"']*["'][\s\S]*?(?=<\w+|$)/gi,
    /id=["'](?:menu|navigation|nav)["'][\s\S]*?(?=<\w+|$)/gi,
    /class=["'][^"']*nav[^"']*["'][\s\S]*?(?=<\w+|$)/gi,
    /<div[^>]*id=["']?(?:naviArea|navi)["']?[^>]*>[\s\S]*?<\/div>/gi,
    /<ul[^>]*class=["'][^"']*(?:menu|nav)[^"']*["'][^>]*>[\s\S]*?<\/ul>/gi,
    /<div[^>]*class=["'][^"']*(?:navigation|header-nav)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi
  ];

  const HIGH_PRIORITY_CONTACT_KEYWORDS = ['contact', 'inquiry', 'form', '問い合わせ', 'お問い合わせ'];

  console.log('Searching in navigation with 9 selectors (including #naviArea, .nav, .navigation, .menu)...');

  let totalMatches = 0;
  let allCandidates: Array<{ url: string, keywords: string[], score: number, reasons: string[] }> = [];

  for (let i = 0; i < NAVIGATION_SELECTORS.length; i++) {
    const regex = NAVIGATION_SELECTORS[i];
    if (!regex) continue;

    const matches = html.match(regex) || [];
    console.log(`Navigation selector ${i+1}: Found ${matches.length} matches`);
    totalMatches += matches.length;

    for (let j = 0; j < matches.length; j++) {
      const match = matches[j];
      if (!match) continue;

      console.log(`Analyzing navigation match ${j+1} (${match.length} chars): ${match.substring(0, 100)}...`);

      // 全リンクを抽出してキーワードフィルタリング
      const candidates = extractAllContactLinks(match, baseUrl);
      allCandidates.push(...candidates);
      console.log(`Navigation match ${j+1} added ${candidates.length} candidates`);
    }
  }

  // 全リンクからキーワード含有リンクのみを選別
  const contactLinks = allCandidates.filter(candidate =>
    HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
      candidate.url.toLowerCase().includes(keyword.toLowerCase()) ||
      candidate.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
    )
  );

  console.log(`Found ${allCandidates.length} total candidates, ${contactLinks.length} with contact keywords`);

  // キーワード含有リンクがあれば最高スコアを選択
  if (contactLinks.length > 0) {
    const best = contactLinks.reduce((max, current) => current.score > max.score ? current : max);
    console.log(`Navigation search best result: ${best.url} (score: ${best.score})`);
    return best;
  }

  console.log(`Navigation search complete: processed ${totalMatches} matches, no contact-related candidates found`);
  return { url: null, keywords: [], score: 0, reasons: [] };
}

/**
 * 全リンク抽出処理
 * HTML内容から全てのリンクを抽出して候補として返す
 * @param content HTML内容
 * @param baseUrl ベースURL
 * @returns リンク候補配列
 */
function extractAllContactLinks(content: string, baseUrl: string): Array<{ url: string, keywords: string[], score: number, reasons: string[] }> {
  const candidates: Array<{ url: string, keywords: string[], score: number, reasons: string[] }> = [];
  const linkRegex = /<a[^>]*href=["']([^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[1];
    const linkText = match[2];

    if (!url || !linkText) continue;

    const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
    
    // Skip non-web URLs
    if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
      continue;
    }

    // Calculate contact purity score (simplified version)
    const score = calculateContactPurity(url, cleanLinkText);
    
    if (score > 0) {
      const fullUrl = resolveUrl(url, baseUrl);
      candidates.push({
        url: fullUrl,
        keywords: extractKeywords(url, cleanLinkText),
        score: score,
        reasons: [`contact_purity_${score}`]
      });
    }
  }

  return candidates;
}

/**
 * 問い合わせ純度計算（簡略版）
 * @param url URL文字列
 * @param linkText リンクテキスト
 * @returns スコア
 */
function calculateContactPurity(url: string, linkText: string): number {
  let score = 0;
  
  // URL pattern scoring
  if (url.includes('/contact')) score += 15;
  if (url.includes('/inquiry')) score += 12;
  if (url.includes('/form')) score += 10;
  
  // Link text scoring
  const lowerText = linkText.toLowerCase();
  if (lowerText.includes('contact') || lowerText.includes('問い合わせ')) score += 10;
  if (lowerText.includes('inquiry') || lowerText.includes('お問い合わせ')) score += 8;
  if (lowerText.includes('form') || lowerText.includes('フォーム')) score += 5;
  
  return score;
}

/**
 * キーワード抽出
 * @param url URL文字列
 * @param linkText リンクテキスト
 * @returns キーワード配列
 */
function extractKeywords(url: string, linkText: string): string[] {
  const keywords: string[] = [];
  
  if (url.includes('/contact')) keywords.push('contact');
  if (url.includes('/inquiry')) keywords.push('inquiry');
  if (url.includes('/form')) keywords.push('form');
  
  const lowerText = linkText.toLowerCase();
  if (lowerText.includes('contact')) keywords.push('contact_text');
  if (lowerText.includes('問い合わせ')) keywords.push('inquiry_text');
  
  return keywords;
}

/**
 * URL解決処理
 * @param url 相対または絶対URL
 * @param baseUrl ベースURL
 * @returns 絶対URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) {
    // Extract origin from baseUrl
    const protocolMatch = baseUrl.match(/^https?:\/\/[^\/]+/);
    return protocolMatch ? protocolMatch[0] + url : baseUrl + url;
  }
  // Simple relative path resolution
  const baseWithoutTrailingSlash = baseUrl.replace(/\/$/, '');
  return baseWithoutTrailingSlash + '/' + url;
}

/**
 * アンカーセクション解析
 * アンカーリンク用の特別処理
 * @param html HTML内容
 * @param anchorUrl アンカーURL
 * @param baseUrl ベースURL
 * @returns 解析結果
 */
export function analyzeAnchorSection(html: string, anchorUrl: string, baseUrl: string): ContactPageResult {
  console.log(`🔍 Analyzing anchor section for: ${anchorUrl}`);
  
  // アンカーIDを抽出
  const anchorId = anchorUrl.split('#')[1];
  if (!anchorId) {
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'anchor_no_id'
    };
  }
  
  // アンカー対応セクションを検索
  const sectionRegex = new RegExp(`id=["']${anchorId}["'][\\s\\S]*?(?=<\\w+[^>]*id=|$)`, 'gi');
  const sections = html.match(sectionRegex) || [];
  
  if (sections.length === 0) {
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: 'anchor_section_not_found'
    };
  }
  
  // セクション内でフォーム検索
  for (const section of sections) {
    if (FormAnalyzer.isValidContactForm(section)) {
      console.log(`✅ Valid form found in anchor section: ${anchorId}`);
      return {
        contactUrl: anchorUrl,
        actualFormUrl: anchorUrl,
        foundKeywords: ['anchor_form', anchorId],
        searchMethod: 'anchor_section_form'
      };
    }
  }
  
  return {
    contactUrl: null,
    actualFormUrl: null,
    foundKeywords: ['anchor_no_form'],
    searchMethod: 'anchor_section_no_form'
  };
}

/**
 * 実際のフォーム検索
 * 問い合わせページ内で実際のフォームを検索
 * @param contactPageUrl 問い合わせページURL
 * @param fetchWithTimeout HTTPリクエスト関数
 * @returns フォームURL（見つからない場合はnull）
 */
export function findActualForm(contactPageUrl: string, fetchWithTimeout: (url: string, timeout: number) => any): string | null {
  try {
    console.log(`🔍 Finding actual form at: ${contactPageUrl}`);
    const response = fetchWithTimeout(contactPageUrl, 5000);
    
    if (response.getResponseCode() !== 200) {
      console.log(`❌ Failed to access form page: ${response.getResponseCode()}`);
      return null;
    }
    
    const html = response.getContentText();
    
    // Standard form validation
    if (FormAnalyzer.isValidContactForm(html)) {
      console.log(`✅ Valid form confirmed at: ${contactPageUrl}`);
      return contactPageUrl;
    }
    
    // Second stage form link search
    const secondStageFormUrl = findSecondStageFormLink(html, contactPageUrl);
    if (secondStageFormUrl) {
      console.log(`✅ Second stage form found: ${secondStageFormUrl}`);
      return secondStageFormUrl;
    }
    
    console.log(`❌ No valid form found at: ${contactPageUrl}`);
    return null;
    
  } catch (error) {
    console.log(`❌ Error finding actual form: ${error}`);
    return null;
  }
}

/**
 * 二段階フォームリンク検索
 * 問い合わせページ内で次のフォームページへのリンクを検索
 * @param html HTML内容
 * @param contactPageUrl ベースURL
 * @returns 二段階フォームURL（見つからない場合はnull）
 */
function findSecondStageFormLink(html: string, contactPageUrl: string): string | null {
  const FORM_LINK_PATTERNS = [
    /href=["']([^"']*form[^"']*?)["']/gi,
    /href=["']([^"']*inquiry[^"']*?)["']/gi,
    /href=["']([^"']*contact[^"']*?)["']/gi
  ];
  
  for (const pattern of FORM_LINK_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1];
      if (url && url !== contactPageUrl) {
        const fullUrl = resolveUrl(url, contactPageUrl);
        console.log(`🔍 Second stage form candidate: ${fullUrl}`);
        return fullUrl;
      }
    }
  }
  
  return null;
}

/**
 * メインHTML解析処理（統合版）
 * 元のindex.tsの処理を完全に保持
 * @param html 解析対象HTML
 * @param baseUrl ベースURL
 * @param state 状態オブジェクト
 * @param fetchWithTimeout HTTPリクエスト関数
 * @returns HTML解析結果
 */
export function analyzeHtmlContent(
  html: string, 
  baseUrl: string, 
  state: Step2AnalysisState,
  fetchWithTimeout: (url: string, timeout: number) => any
): ContactPageResult {
  console.log('=== Starting navigation-only HTML analysis ===');

  // Navigation search only
  console.log('Stage 1: Navigation search');
  const navResult = searchInNavigation(html, baseUrl);
  if (navResult.url && navResult.score > 0) {
    console.log(`Navigation search result: ${navResult.url} (score: ${navResult.score}, reasons: ${navResult.reasons.join(',')})`);

    // 重複回避チェック：Step1で成功したフォームURLのみスキップ（失敗したURLは再検証）
    const isSuccessfulFormDuplicate = state.successfulFormUrls.includes(navResult.url);
    if (isSuccessfulFormDuplicate) {
      console.log(`⏭ Skipping duplicate URL (already succeeded in Step1): ${navResult.url}`);
    } else {
      // Check if this is an anchor link for special processing
      if (UrlUtils.isAnchorLink(navResult.url)) {
        console.log(`🔍 Anchor link detected: ${navResult.url}, analyzing section content`);
        const anchorSectionResult = analyzeAnchorSection(html, navResult.url, baseUrl);
        if (anchorSectionResult.contactUrl) {
          console.log(`✅ Found contact info in anchor section: ${anchorSectionResult.contactUrl}`);
          return anchorSectionResult;
        }
      }

      // 新規URLの場合：実際にアクセスしてform検証+Google Forms検証
      console.log(`🔍 New URL found, performing detailed validation: ${navResult.url}`);

      try {
        const response = fetchWithTimeout(navResult.url, 5000);
        if (response.getResponseCode() === 200) {
          const candidateHtml = response.getContentText();

          // A. 標準フォーム検証
          const isValidForm = FormAnalyzer.isValidContactForm(candidateHtml);
          if (isValidForm) {
            console.log(`✅ Standard form confirmed at ${navResult.url}`);
            return {
              contactUrl: navResult.url,
              actualFormUrl: navResult.url,
              foundKeywords: [...navResult.keywords, 'form_validation_success'],
              searchMethod: 'homepage_navigation_form'
            };
          }

          // B. Google Forms検証
          const googleFormsResult = FormAnalyzer.detectGoogleForms(candidateHtml);
          if (googleFormsResult.found && googleFormsResult.url) {
            console.log(`✅ Google Forms confirmed at ${navResult.url} -> ${googleFormsResult.url}`);
            return {
              contactUrl: navResult.url,
              actualFormUrl: googleFormsResult.url,
              foundKeywords: [...navResult.keywords, 'google_forms', googleFormsResult.type],
              searchMethod: 'homepage_navigation_google_forms'
            };
          }

          // C. キーワードベース判定（Step2の高信頼度fallback）
          console.log(`📝 High-confidence keyword-based judgment for: ${navResult.url}`);
          return {
            contactUrl: navResult.url,
            actualFormUrl: navResult.url,
            foundKeywords: [...navResult.keywords, 'keyword_based_judgment'],
            searchMethod: 'homepage_navigation_keyword'
          };
        } else {
          console.log(`❌ Failed to access ${navResult.url}: ${response.getResponseCode()}`);
        }
      } catch (error) {
        console.log(`❌ Error accessing ${navResult.url}: ${error}`);
      }
    }
  }

  // No navigation links found or suitable
  console.log('Navigation search found no suitable links');
  return {
    contactUrl: null,
    actualFormUrl: null,
    foundKeywords: [],
    searchMethod: 'navigation_search_failed'
  };
}