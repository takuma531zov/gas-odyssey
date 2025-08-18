/**
 * フォーム検証システムモジュール
 * ページ内容からフォーム関連要素を検証・判定する機能
 * 
 * 【処理内容】
 * - 問い合わせページ内容検証
 * - Google Form内容検証・除外判定
 * - ページ有効性検証（404除外等）
 */

import { FormAnalyzer } from '../../analyzers/FormAnalyzer';
import { VALIDATION_PATTERNS, GOOGLE_FORM_EXCLUDE_KEYWORDS, GOOGLE_FORM_CONTACT_KEYWORDS } from '../../constants/SearchConstants';

/**
 * 問い合わせページ内容検証
 * ページHTMLから実際のフォームURLを検出・検証
 * @param html ページHTML内容
 * @param pageUrl ページURL
 * @param hasContactRelatedLinks リンク存在チェック関数
 * @returns 検証結果（フォームURLとキーワード）
 */
export function validateContactPageContent(
  html: string, 
  pageUrl: string,
  hasContactRelatedLinksFunc: (html: string) => { hasLinks: boolean, linkTexts: string[] }
): { actualFormUrl: string | null, keywords: string[] } {
  // 1. 埋め込みHTMLフォーム検索（最優先）
  const embeddedForm = FormAnalyzer.findEmbeddedHTMLForm(html);
  if (embeddedForm) {
    return { actualFormUrl: pageUrl, keywords: ['embedded_form'] };
  }

  // 2. 統合検証：フォーム関連コンテンツ + キーワード + 送信要素
  const formAnalysis = FormAnalyzer.analyzeFormElements(html);
  if (formAnalysis.isValidForm) {
    console.log(`Integrated form validation successful: ${formAnalysis.reasons.join(',')}`);
    return { actualFormUrl: pageUrl, keywords: formAnalysis.keywords };
  }

  // 4. Google Forms検索（検証付き - 優先度を下げる）
  const googleFormUrl = FormAnalyzer.findGoogleFormUrlsOnly(html);
  if (googleFormUrl && googleFormUrl.startsWith('http')) {
    // Google Formの内容を検証して除外すべきフォームかチェック
    const isValidContactForm = validateGoogleFormContent(html, googleFormUrl);
    if (isValidContactForm) {
      console.log(`Valid Google Form found: ${googleFormUrl}`);
      return { actualFormUrl: googleFormUrl, keywords: ['google_form'] };
    } else {
      console.log(`Google Form found but excluded (likely recruitment/other): ${googleFormUrl}`);
    }
  }

  // 5. ２段階リンク検出（他ページ探索 - fallback）
  // Legacy implementation removed - using module version
  console.log('Second stage form link detection skipped (moved to module)');

  // 6. ページ内リンク存在チェック（中間ページ判定）
  const hasContactLinks = hasContactRelatedLinksFunc(html);
  if (hasContactLinks.hasLinks) {
    console.log(`Contact-related links found: ${hasContactLinks.linkTexts.join(',')}`);
    console.log('Page has contact links but no actual forms - suggesting this is an intermediate page');
    return { actualFormUrl: null, keywords: ['has_contact_links_but_no_forms'] };
  }

  return { actualFormUrl: null, keywords: [] };
}

/**
 * Google Form内容検証
 * Google Formが問い合わせフォームかどうか判定（採用・アンケート等を除外）
 * @param html ページHTML内容
 * @param googleFormUrl Google FormのURL
 * @returns 有効な問い合わせフォームの場合true
 */
export function validateGoogleFormContent(html: string, googleFormUrl: string): boolean {
  // 除外すべきキーワード（BtoB営業用途に関係ないフォーム）

  // 問い合わせ関連キーワード

  const lowerHtml = html.toLowerCase();

  // Google Formの周辺コンテキストを抽出（フォームURLの前後1000文字）
  const formUrlIndex = html.indexOf(googleFormUrl);
  const contextStart = Math.max(0, formUrlIndex - 1000);
  const contextEnd = Math.min(html.length, formUrlIndex + googleFormUrl.length + 1000);
  const context = html.substring(contextStart, contextEnd).toLowerCase();

  // 除外キーワードが含まれているかチェック
  const hasExcludeKeyword = GOOGLE_FORM_EXCLUDE_KEYWORDS.some(keyword =>
    context.includes(keyword.toLowerCase())
  );

  if (hasExcludeKeyword) {
    console.log(`Google Form excluded due to keywords: ${GOOGLE_FORM_EXCLUDE_KEYWORDS.filter(k => context.includes(k.toLowerCase())).join(',')}`);
    return false;
  }

  // 問い合わせ関連キーワードの存在確認
  const hasContactKeyword = GOOGLE_FORM_CONTACT_KEYWORDS.some(keyword =>
    context.includes(keyword.toLowerCase())
  );

  if (hasContactKeyword) {
    console.log(`Google Form validated with contact keywords: ${GOOGLE_FORM_CONTACT_KEYWORDS.filter(k => context.includes(k.toLowerCase())).join(',')}`);
    return true;
  }

  // コンテキストが不明な場合は、より広範囲でチェック
  const hasPageLevelContactKeyword = GOOGLE_FORM_CONTACT_KEYWORDS.some(keyword =>
    lowerHtml.includes(keyword.toLowerCase())
  );

  if (hasPageLevelContactKeyword) {
    console.log(`Google Form validated with page-level contact keywords`);
    return true;
  }

  // 明確な問い合わせ関連キーワードがない場合は除外
  console.log(`Google Form excluded - no clear contact context found`);
  return false;
}

/**
 * ページ有効性検証
 * 404ページや無効なページを除外
 * @param html ページHTML内容
 * @returns 有効なページの場合true
 */
export function isValidContactPage(html: string): boolean {
  // 404ページや無効なページを除外（より厳密なパターンに変更）

  const lowerHtml = html.toLowerCase();
  const hasInvalidContent = VALIDATION_PATTERNS.INVALID_PAGE.some(pattern =>
    lowerHtml.includes(pattern.toLowerCase())
  );

  // 最低限のコンテンツ長チェック
  const hasMinimumContent = html.length > VALIDATION_PATTERNS.MINIMUM_CONTENT_LENGTH;

  console.log(`Validity check - hasInvalidContent: ${hasInvalidContent}, hasMinimumContent: ${hasMinimumContent}, length: ${html.length}`);
  if (hasInvalidContent) {
    const matchedPattern = VALIDATION_PATTERNS.INVALID_PAGE.find(pattern => lowerHtml.includes(pattern.toLowerCase()));
    console.log(`Invalid pattern found: ${matchedPattern}`);
  }

  return !hasInvalidContent && hasMinimumContent;
}