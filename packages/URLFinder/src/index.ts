import { Environment } from './env';
import type { ContactPageResult } from './types/interfaces';
import { HIGH_PRIORITY_PATTERNS, EXCLUDED_KEYWORDS, HIGH_PRIORITY_CONTACT_KEYWORDS, MEDIUM_PRIORITY_CONTACT_KEYWORDS, SUBMIT_BUTTON_KEYWORDS, FORM_KEYWORDS } from './constants/ContactConstants';
import { SEARCH_PATTERNS, CONFIDENCE_LEVELS, NAVIGATION_SELECTORS, VALIDATION_PATTERNS, FORM_LINK_PATTERNS, FORM_TEXT_PATTERNS, NEGATIVE_KEYWORDS, HOMEPAGE_PATTERNS, CONTACT_LINK_KEYWORDS, GOOGLE_FORM_EXCLUDE_KEYWORDS, GOOGLE_FORM_CONTACT_KEYWORDS } from './constants/SearchConstants';
import { UrlUtils } from './utils/UrlUtils';
import { PurityUtils } from './utils/PurityUtils';
import { HtmlAnalyzer } from './analyzers/HtmlAnalyzer';
import { FormAnalyzer } from './analyzers/FormAnalyzer';
import { UrlPatternStrategy } from './strategies/UrlPatternStrategy';

// === 機能モジュール群インポート ===
import { 
  initializeContactSearch as moduleInitializeContactSearch,
  resetCandidates as moduleResetCandidates, 
  checkDomainAvailability as moduleCheckDomainAvailability,
  type InitializationState 
} from './modules/initialization';  // 初期化・検証機能 (modules/initialization/index.ts)

import {
  analyzeHtmlContent as moduleAnalyzeHtmlContent,
  searchInNavigation as moduleSearchInNavigation,
  analyzeAnchorSection as moduleAnalyzeAnchorSection, 
  findActualForm as moduleFindActualForm,
  type Step2AnalysisState
} from './modules/step2Analysis';  // Step2解析機能 (modules/step2Analysis/index.ts)

import {
  getFinalFallbackUrl as moduleGetFinalFallbackUrl,
  evaluateFallbackUrlQuality as moduleEvaluateFallbackUrlQuality,
  calculateCandidateScore as moduleCalculateCandidateScore,
  logPotentialCandidate as moduleLogPotentialCandidate,
  type FallbackState
} from './modules/fallbackSystem';  // フォールバック機能 (modules/fallbackSystem/index.ts)

import {
  validateContactPageContent as moduleValidateContactPageContent,
  validateGoogleFormContent as moduleValidateGoogleFormContent,
  isValidContactPage as moduleIsValidContactPage
} from './modules/formValidation';  // フォーム検証機能 (modules/formValidation/index.ts)

import {
  extractContactLinks as moduleExtractContactLinks,
  hasContactRelatedLinks as moduleHasContactRelatedLinks
} from './modules/linkAnalysis';  // リンク解析機能 (modules/linkAnalysis/index.ts)

import {
  fetchWithTimeout as moduleFetchWithTimeout,
  getDetailedErrorMessage as moduleGetDetailedErrorMessage,
  getDetailedNetworkError as moduleGetDetailedNetworkError
} from './modules/httpUtils';  // HTTP通信機能 (modules/httpUtils/index.ts)

import {
  executeSPAAnalysis as moduleExecuteSPAAnalysis,
  detectSameHtmlPattern as moduleDetectSameHtmlPattern
} from './modules/spaAnalysis';  // SPA解析機能 (modules/spaAnalysis/index.ts)

/**
 * ContactPageFinder - BtoB営業用問い合わせページ自動検索システム
 *
 * 【目的】
 * - 企業サイトから問い合わせページを自動発見
 * - Google Apps Script環境での安定動作
 * - BtoB営業活動の効率化支援
 *
 * 【検索戦略】
 * Step1: URLパターン推測（高速・高精度）
 * Step2: HTML解析によるフォールバック検索
 * Final: 最終フォールバック（Step1の200 OKページ使用）
 *
 * 【対応機能】
 * - SPA（Single Page Application）対応
 * - Google Forms検出
 * - 埋め込みフォーム対応
 * - JavaScript動的フォーム検出
 * - タイムアウト管理による安定性確保
 */
class ContactPageFinder {

  // ==========================================
  // 状態管理・キャッシュシステム（モジュール化統合）
  // ==========================================

  /**
   * 初期化状態管理
   * modules/initialization で管理される状態変数群
   */
  private static initState: InitializationState = {
    candidatePages: [],
    validUrls: [],
    successfulFormUrls: [],
    sameHtmlCache: {}
  };

  // ==========================================
  // 後方互換性のためのプロパティ（レガシーアクセス用）
  // ==========================================

  /**
   * 候補ページ記録システム（レガシーアクセス用）
   * modules/initialization の状態を参照
   */
  private static get candidatePages() { return this.initState.candidatePages; }
  private static set candidatePages(value) { this.initState.candidatePages = value; }

  /**
   * 200 OK URLリスト（レガシーアクセス用）  
   * modules/initialization の状態を参照
   */
  private static get validUrls() { return this.initState.validUrls; }
  private static set validUrls(value) { this.initState.validUrls = value; }

  /**
   * 成功したフォームURLリスト（レガシーアクセス用）
   * modules/initialization の状態を参照
   */
  private static get successfulFormUrls() { return this.initState.successfulFormUrls; }
  private static set successfulFormUrls(value) { this.initState.successfulFormUrls = value; }





  // ==========================================
  // SPA検出・同一HTML判定システム
  // ==========================================

  /**
   * 同一HTMLレスポンス検出キャッシュ（レガシーアクセス用）
   * modules/initialization の状態を参照
   */
  private static get sameHtmlCache() { return this.initState.sameHtmlCache; }
  private static set sameHtmlCache(value) { this.initState.sameHtmlCache = value; }


  // ==========================================
  // メイン検索エントリーポイント
  // ==========================================

  /**
   * 問い合わせページ検索のメインエントリーポイント
   *
   * @param baseUrl 検索対象のベースURL（企業サイトのトップページ等）
   * @returns ContactPageResult 検索結果（URL、フォーム情報、検索手法等）
   *
   * 【処理フロー】
   * 1. 初期化処理（候補リセット、タイマー開始）
   * 2. SNSページ判定（Facebook、Twitter等は除外）
   * 3. ドメイン生存確認（サイト閉鎖チェック）
   * 4. Step1: URLパターン推測検索
   * 5. Step2: HTML解析フォールバック検索
   * 6. 最終フォールバック: Step1の200 OKページ使用
   *
   * 実装注意事項:
   * - GAS環境でのタイムアウト管理（デフォルト80秒）
   * - メモリ効率を考慮したキャッシュ管理
   * - BtoB営業用途に特化したキーワード重み付け
   * - SPA（Single Page Application）対応
   */
  static findContactPage(baseUrl: string): ContactPageResult {
    const startTime = Date.now();
    const maxTotalTime = Environment.getMaxTotalTime();

    try {
      // 初期化・検証処理
      const initResult = this.initializeContactSearch(baseUrl);
      if (initResult) {
        return initResult; // 早期return（SNS/ドメイン無効の場合）
      }

      // Extract domain for subdirectory pattern support
      const domainUrl = UrlUtils.extractDomain(baseUrl);

      console.log(`Starting contact page search for: ${baseUrl}`);

      // STEP 1: URL pattern guessing with integrated SPA detection (HIGHEST PRIORITY - Fast & Accurate)
      console.log('Step 1: URL pattern guessing with SPA optimization (primary strategy)');
      const urlPatternStrategy = new UrlPatternStrategy();
      const strategyResult = urlPatternStrategy.searchDetailed(domainUrl);

      if (strategyResult) {
        const priorityResult = strategyResult.result;
        // 有効URLリストを更新
        this.validUrls = strategyResult.validUrls;

        if (priorityResult.contactUrl) {
          console.log(`✅ Found via URL pattern search: ${priorityResult.contactUrl}`);
          return priorityResult;
        }

        // エラーの場合は即座に返す（fallback処理をスキップ）
        if (priorityResult.searchMethod === 'dns_error' || priorityResult.searchMethod === 'bot_blocked') {
          console.log(`URL pattern search returned error: ${priorityResult.searchMethod}, stopping here`);
          return priorityResult;
        }
      }

      // Check remaining time
      if (Date.now() - startTime > maxTotalTime) {
        console.log('Timeout reached during URL pattern search');
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: ['timeout'],
          searchMethod: 'timeout'
        };
      }

      // STEP 2: Homepage HTML analysis (FALLBACK for special cases like ye-p.co.jp)
      console.log('Step 2: Homepage HTML analysis as fallback for special cases');
      try {
        const response = moduleFetchWithTimeout(baseUrl, 7000); // 7秒タイムアウト
        const html = HtmlAnalyzer.getContentWithEncoding(response); // 🔥 文字化け解決

        // Check for Google Forms URLs first
        const googleFormUrls = FormAnalyzer.findGoogleFormUrlsOnly(html);
        if (googleFormUrls) {
          console.log(`✅ Found Google Form URL on homepage: ${googleFormUrls}`);
          return {
            contactUrl: baseUrl,
            actualFormUrl: googleFormUrls,
            foundKeywords: ['homepage_google_form'],
            searchMethod: 'homepage_google_form_fallback'
          };
        }

        // Analyze HTML content for contact links
        const step2State: Step2AnalysisState = { successfulFormUrls: this.successfulFormUrls };
        const result = moduleAnalyzeHtmlContent(html, baseUrl, step2State, moduleFetchWithTimeout);

        // If we found a contact page, try to find the actual form within it
        if (result.contactUrl) {
          console.log(`Found contact link on homepage: ${result.contactUrl}`);
          const formUrl = moduleFindActualForm(result.contactUrl, moduleFetchWithTimeout);
          result.actualFormUrl = formUrl;
          result.searchMethod = 'homepage_link_fallback';

          // If actual form found, return it
          if (result.actualFormUrl && result.actualFormUrl.startsWith('http')) {
            console.log(`✅ Verified actual form at: ${result.actualFormUrl}`);
            return result;
          } else if (result.actualFormUrl === 'embedded_contact_form_on_page') {
            console.log(`✅ Verified embedded form at: ${result.contactUrl}`);
            // Fix: Return actual contact URL instead of placeholder
            result.actualFormUrl = result.contactUrl;
            return result;
          } else {
            console.log(`Contact page found but no form verified: ${result.contactUrl}`);
            return result;
          }
        }

        // Check for embedded forms as last resort
        const embeddedFormResult = FormAnalyzer.findEmbeddedHTMLForm(html);
        if (embeddedFormResult) {
          console.log(`✅ Found embedded form on homepage as last resort`);
          return {
            contactUrl: baseUrl,
            actualFormUrl: baseUrl, // Fix: Return actual URL instead of placeholder
            foundKeywords: ['homepage_embedded_form'],
            searchMethod: 'homepage_embedded_fallback'
          };
        }

        console.log('HTML analysis fallback found nothing');

      } catch (homepageError) {
        const detailedError = moduleGetDetailedNetworkError(homepageError);
        console.log(`Error in homepage analysis fallback: ${detailedError}`);
      }

      // FINAL FALLBACK: Return first valid contact URL from Step1 if available
      console.log('All search methods failed, checking final fallback...');
      const fallbackState: FallbackState = { 
        validUrls: this.validUrls, 
        candidatePages: this.candidatePages 
      };
      const fallbackResult = moduleGetFinalFallbackUrl(fallbackState);
      if (fallbackResult.contactUrl) {
        console.log(`✅ Final fallback successful: ${fallbackResult.contactUrl}`);
        return fallbackResult;
      }

      console.log('All search methods failed, including final fallback');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: 'not_found'
      };
    } catch (error) {
      const detailedError = moduleGetDetailedNetworkError(error);
      console.error(`Error fetching ${baseUrl}: ${detailedError}`);
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [detailedError],
        searchMethod: 'error'
      };
    }
  }

  /**
   * 初期化・検証処理（プロキシ）
   * modules/initialization/index.ts の機能を呼び出し
   * @param baseUrl 検証対象URL
   * @returns 早期終了の場合は結果、継続の場合はnull
   */
  private static initializeContactSearch(baseUrl: string): ContactPageResult | null {
    return moduleInitializeContactSearch(baseUrl, this.initState);
  }

  // ==========================================
  // HTML解析・フォールバック検索システム
  // ==========================================

  // ==========================================
  // ナビゲーション解析システム
  // ==========================================

  /**
   * ナビゲーション内検索
   * ページのナビゲーション要素から問い合わせリンクを検索
   * @param html 検索対象HTML
   * @param baseUrl ベースURL
   * @returns ナビゲーション検索結果
   */

  // ==========================================
  // リンク抽出・解析システム
  // ==========================================







  /**
   * 問い合わせリンク抽出
   * HTML内容から問い合わせ関連リンクを抽出・解析
   * @param content 解析対象HTML内容
   * @param baseUrl ベースURL
   * @param contextType コンテキストタイプ（general/navigation等）
   * @returns 抽出されたリンク情報
   */



  // ==========================================
  // ユーティリティ・補助機能システム
  // ==========================================

  /**
   * トップページURL判定
   * ２段階リンク検出での除外用判定
   * @param url 判定対象URL
   * @param baseUrl ベースURL
   * @returns トップページの場合true
   */
  private static isHomepageUrl(url: string, baseUrl: string): boolean {
    return PurityUtils.isHomepageUrl(url, baseUrl);
  }










  // ==========================================
  // 候補管理・スコアリングシステム
  // ==========================================

  /**
   * 潜在的候補ページの記録
   * Step1で発見されたが確定できなかった候補を記録・評価
   * @param url 候補URL
   * @param reason 候補理由
   * @param html ページHTML内容
   */

  /**
   * 候補スコア計算
   * 候補ページの品質をURL、フォーム分析結果に基づいて数値化
   * @param url 候補URL
   * @param reason 候補理由
   * @param structuredAnalysis 構造化フォーム解析結果
   * @param formAnalysis フォーム解析結果
   * @returns 計算されたスコア
   */

  /**
   * 候補リストリセット（プロキシ）
   * modules/initialization/index.ts の機能を呼び出し
   */
  private static resetCandidates() {
    moduleResetCandidates(this.initState);
  }

  /**
   * 問い合わせ関連リンク存在チェック
   * ページ内に問い合わせ関連のリンクが存在するかチェック（BtoB営業用途特化）
   * @param html 検索対象HTML
   * @returns リンク存在情報とリンクテキスト配列
   */


  // Google FormsのURLのみを検出（埋め込みフォーム検出は除外）



  // ==========================================
  // HTTP通信・エラーハンドリングシステム
  // ==========================================

  /**
   * タイムアウト付きHTTP取得
   * GAS環境でのHTTPリクエスト実行（タイムアウト管理）
   * @param url 取得対象URL
   * @param _timeoutMs タイムアウト時間（ms）※GASでは利用不可
   * @returns HTTPレスポンス
   */



  // ==========================================
  // フォーム検証・内容解析システム
  // ==========================================

  /**
   * 問い合わせページ内容検証
   * ページHTMLから実際のフォームURLを検出・検証
   * @param html ページHTML内容
   * @param pageUrl ページURL
   * @returns 検証結果（フォームURLとキーワード）
   */

  /**
   * Google Form内容検証
   * Google Formが問い合わせフォームかどうか判定（採用・アンケート等を除外）
   * @param html ページHTML内容
   * @param googleFormUrl Google FormのURL
   * @returns 有効な問い合わせフォームの場合true
   */

  private static getDetailedErrorMessage(statusCode: number): string {
    return PurityUtils.getDetailedErrorMessage(statusCode);
  }

  /**
   * 詳細ネットワークエラー解析
   * エラーオブジェクトから詳細なエラー原因を特定
   * @param error エラーオブジェクト
   * @returns 詳細エラーメッセージ
   */
  private static getDetailedNetworkError(error: any): string {
    return PurityUtils.getDetailedNetworkError(error);
  }

  /**
   * ドメイン生存確認（プロキシ）
   * modules/initialization/index.ts の機能を呼び出し
   * @param baseUrl 確認対象URL
   * @returns 生存状況と詳細エラー
   */
  private static checkDomainAvailability(baseUrl: string): { available: boolean, error?: string } {
    return moduleCheckDomainAvailability(baseUrl);
  }




}

/**
 * 後方互換性維持のためのラッパー関数
 * 既存の呼び出し元コードを変更せずに新しいアーキテクチャを使用可能
 *
 * @param url 検索対象URL
 * @returns ContactPageResult 検索結果
 *
 * 使用例:
 * const result = findContactPage('https://example.com');
 * console.log(result.contactUrl); // 問い合わせページURL
 * console.log(result.searchMethod); // 使用された検索手法
 */
function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}

function processContactPageFinder() {
  try {
    // スクリプトプロパティから設定値を取得
    const properties = PropertiesService.getScriptProperties();
    const sheetName = properties.getProperty('SHEET');
    const maxCountStr = properties.getProperty('MAX_COUNT');
    const headerRowStr = properties.getProperty('HEADER_ROW');

    if (!sheetName) {
      throw new Error('スクリプトプロパティ「SHEET」が設定されていません');
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`シート「${sheetName}」が見つかりません`);
    }

    // MAX_COUNTの処理（未設定の場合は制限なし）
    const maxCount = maxCountStr ? parseInt(maxCountStr, 10) : null;
    if (maxCountStr && isNaN(maxCount!)) {
      throw new Error('スクリプトプロパティ「MAX_COUNT」は数値で設定してください');
    }

    // HEADER_ROWの処理（未設定の場合は1行目）
    const headerRow = headerRowStr ? parseInt(headerRowStr, 10) : 1;
    if (headerRowStr && isNaN(headerRow!)) {
      throw new Error('スクリプトプロパティ「HEADER_ROW」は数値で設定してください');
    }

    console.log(`処理上限: ${maxCount ? `${maxCount}行` : '制限なし'}`);
    console.log(`ヘッダー行: ${headerRow}行目（処理対象から除外）`);

    // L列の最終行を取得
    const lastRowL = sheet.getLastRow();

    // AP列の最終行を取得（データがある行）
    const apRange = sheet.getRange('AP:AP');
    const apValues = apRange.getValues();
    let lastRowAP = 0;
    for (let i = apValues.length - 1; i >= 0; i--) {
      const row = apValues[i];
      if (row && row[0] !== '') {
        lastRowAP = i + 1;
        break;
      }
    }

    // 処理対象行の範囲を決定
    const startRow = lastRowAP + 1;
    let endRow = lastRowL;

    if (startRow > endRow) {
      console.log('処理対象のURLがありません');
      return;
    }

    // MAX_COUNTによる上限制御
    if (maxCount && (endRow - startRow + 1) > maxCount) {
      endRow = startRow + maxCount - 1;
      console.log(`MAX_COUNT制限により処理行数を${maxCount}行に制限します`);
    }

    console.log(`処理対象行: ${startRow}行目から${endRow}行目まで（${endRow - startRow + 1}行）`);

    // L列のURLを一括取得
    const urlRange = sheet.getRange(startRow, 12, endRow - startRow + 1, 1); // L列は12列目
    const urls = urlRange.getValues();

    // 結果配列を準備
    const results = [];

    // 各URLを処理
    for (let i = 0; i < urls.length; i++) {
      const urlRow = urls[i];
      const url = urlRow && urlRow[0];
      const currentRow = startRow + i;

      if (!url || url.toString().trim() === '') {
        results.push(['']);
        continue;
      }

      // ヘッダー行の場合はスキップ
      if (currentRow === headerRow) {
        console.log(`${currentRow}行目: ヘッダー行のためスキップ`);
        results.push(['']);
        continue;
      }

      console.log(`${currentRow}行目: ${url} を処理中...`);

      try {
        const result = findContactPage(url.toString().trim());

        console.log(`Result for ${currentRow}行目: searchMethod=${result.searchMethod}, foundKeywords=${result.foundKeywords ? result.foundKeywords.join(',') : 'none'}`);

        // actualFormURLをチェックして出力値を決定
        let outputValue = '';

        // エラーの場合はエラーメッセージを出力
        if (result.searchMethod === 'error' || result.searchMethod === 'dns_error' || result.searchMethod === 'bot_blocked' || result.searchMethod === 'site_closed') {
          if (result.foundKeywords && result.foundKeywords.length > 0) {
            outputValue = result.foundKeywords[0] || 'エラーが発生しました'; // 詳細エラーメッセージ
            console.log(`Using error message: ${outputValue}`);
          } else {
            outputValue = 'エラーが発生しました';
            console.log(`Using default error message: ${outputValue}`);
          }
        } else if (result.actualFormUrl) {
          // 実際のURLの場合はそのURL、識別子の場合はフォームが存在するページのURLを出力
          if (result.actualFormUrl.startsWith('http')) {
            outputValue = result.actualFormUrl;
          } else {
            // 識別子の場合、フォームが存在するページのURLを出力
            outputValue = result.contactUrl || url.toString().trim();
          }
        } else if (result.contactUrl) {
          // actualFormUrlはないが、contactUrlがある場合
          outputValue = result.contactUrl;
        } else {
          // SNSページや見つからない場合
          outputValue = '問い合わせフォームが見つかりませんでした';
        }

        results.push([outputValue]);
        console.log(`${currentRow}行目: 完了 - ${outputValue}`);

      } catch (error) {
        const errorMessage = `エラー: ${error instanceof Error ? error.message : String(error)}`;
        results.push([errorMessage]);
        console.error(`${currentRow}行目: ${errorMessage}`);
      }
    }

    // AP列に結果を一括書き込み
    const outputRange = sheet.getRange(startRow, 42, results.length, 1); // AP列は42列目
    outputRange.setValues(results);

    console.log(`処理完了: ${results.length}行の結果をAP列に出力しました`);

    // MAX_COUNT制限で処理が打ち切られた場合の通知
    if (maxCount && results.length === maxCount && startRow + maxCount - 1 < lastRowL) {
      console.log(`注意: MAX_COUNT(${maxCount})制限により処理を制限しました。残り${lastRowL - (startRow + maxCount - 1)}行のデータが未処理です。`);
    }

  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * テスト用関数
 * 任意のURLでContactPageFinderの動作をテスト
 */
function test() {
  // テスト用URL（任意に変更可能）
  const testUrl = 'https://www.alleyoop.co.jp/';

  console.log(`\n=== URLFinder テスト実行: ${testUrl} ===`);
  const result = findContactPage(testUrl);

  console.log('=== Contact Page Finder Results ===');
  console.log(`Target URL: ${testUrl}`);
  console.log(`Contact URL: ${result.contactUrl}`);
  console.log(`Actual Form URL: ${result.actualFormUrl}`);
  console.log(`Found Keywords: ${result.foundKeywords.join(',')}`);
  console.log(`Search Method: ${result.searchMethod}`);
  console.log('=====================================');
}


/**
 * スプレッドシートUI付きURLFinder実行関数
 * GAS上のスプレッドシートボタンから実行される
 */
function executeUrlFinderWithUI(): void {
  console.log('=== URLFinder UI 開始 ===');

  try {
    // チェック行数を取得
    const checkedCount = getCheckedRowsCount();
    const maxCount = getMaxCountSetting();

    // 実行オプション選択ダイアログを表示
    const htmlTemplate = HtmlService.createTemplateFromFile('simple-options');
    htmlTemplate.checkedCount = checkedCount;
    htmlTemplate.maxCount = maxCount;

    const htmlOutput = htmlTemplate.evaluate()
      .setWidth(450)
      .setHeight(320)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    SpreadsheetApp.getUi()
      .showModalDialog(htmlOutput, 'URLFinder - 実行オプション');

  } catch (error) {
    console.error('UI実行エラー:', error);
    const err = error as Error;
    SpreadsheetApp.getUi().alert('エラー', `実行中にエラーが発生しました: ${err.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 選択されたオプションに基づいて処理を実行
 * @param mode 'normal' | 'checked'
 */
function executeSelectedMode(mode: string): void {
  console.log(`選択されたモード: ${mode}`);

  if (mode === 'normal') {
    executeNormalProcessing();
  } else if (mode === 'checked') {
    executeCheckedRowsProcessing();
  } else {
    throw new Error(`不明な実行モード: ${mode}`);
  }
}

/**
 * 通常処理（既存ロジックをそのまま使用）
 */
function executeNormalProcessing(): void {
  console.log('=== 通常処理開始 ===');

  try {
    // 既存のprocessContactPageFinder関数をそのまま呼び出し
    processContactPageFinder();

    console.log('通常処理が完了しました');

  } catch (error) {
    console.error('通常処理エラー:', error);
    SpreadsheetApp.getUi().alert('エラー', `通常処理中にエラーが発生しました: ${error}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * チェック行のみ処理（新機能）
 */
function executeCheckedRowsProcessing(): void {
  console.log('=== チェック行処理開始 ===');

  try {
    const checkedRows = getCheckedRows();

    if (checkedRows.length === 0) {
      SpreadsheetApp.getUi().alert('チェックされた行がありません。');
      return;
    }

    // 各チェック行を順次処理
    let successCount = 0;
    let failureCount = 0;

    for (const rowNumber of checkedRows) {
      try {
        // L列からURL取得
        const url = getUrlFromRow(rowNumber!);

        if (!url || typeof url !== 'string' || url.trim() === '') {
          console.log(`${rowNumber}行目: URLが空です`);
          continue;
        }

        console.log(`${rowNumber}行目を処理中: ${url}`);

        // 既存のfindContactPage関数を使用
        const result: ContactPageResult = findContactPage(url);

        // AP列に結果を書き込み
        writeResultToSheet(rowNumber!, result);

        if (result.contactUrl) {
          successCount++;
        } else {
          failureCount++;
        }

      } catch (error) {
        console.error(`${rowNumber}行目の処理でエラー:`, error);
        failureCount++;
      }
    }

    // 完了メッセージ
    SpreadsheetApp.getUi().alert('処理完了', `チェック行処理が完了しました。成功: ${successCount}件、失敗: ${failureCount}件`, SpreadsheetApp.getUi().ButtonSet.OK);

  } catch (error) {
    console.error('チェック行処理エラー:', error);
    SpreadsheetApp.getUi().alert('エラー', `チェック行処理中にエラーが発生しました: ${error}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 指定行のL列からURLを取得
 */
function getUrlFromRow(rowNumber: number): string {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lColumn = 12; // L列

  const cellValue = sheet.getRange(rowNumber, lColumn).getValue();
  return cellValue ? cellValue.toString().trim() : '';
}

/**
 * 結果をAP列に書き込み（既存ロジックと完全に一致）
 */
function writeResultToSheet(rowNumber: number, result: ContactPageResult): void {
  const sheet = SpreadsheetApp.getActiveSheet();
  const apColumn = 42; // AP列

  // 既存のprocessContactPageFinderと完全に同じロジック
  let outputValue = '';

  // エラーの場合はエラーメッセージを出力
  if (result.searchMethod === 'error' || result.searchMethod === 'dns_error' || result.searchMethod === 'bot_blocked' || result.searchMethod === 'site_closed') {
    if (result.foundKeywords && result.foundKeywords.length > 0) {
      outputValue = result.foundKeywords[0] || 'エラーが発生しました'; // 詳細エラーメッセージ
    } else {
      outputValue = 'エラーが発生しました';
    }
  } else if (result.actualFormUrl) {
    // 実際のURLの場合はそのURL、識別子の場合はフォームが存在するページのURLを出力
    if (result.actualFormUrl.startsWith('http')) {
      outputValue = result.actualFormUrl;
    } else {
      // 識別子の場合、フォームが存在するページのURLを出力
      outputValue = result.contactUrl || '問い合わせフォームが見つかりませんでした';
    }
  } else if (result.contactUrl) {
    // actualFormUrlはないが、contactUrlがある場合
    outputValue = result.contactUrl;
  } else {
    // SNSページや見つからない場合
    outputValue = '問い合わせフォームが見つかりませんでした';
  }

  sheet.getRange(rowNumber, apColumn).setValue(outputValue);
}

/**
 * AQ列でチェックされた行番号一覧を取得
 */
function getCheckedRows(): number[] {
  try {
    console.log('SpreadsheetApp.getActiveSheet()実行中...');
    const sheet = SpreadsheetApp.getActiveSheet();
    console.log('アクティブシート取得完了');

    console.log('sheet.getLastRow()実行中...');
    const lastRow = sheet.getLastRow();
    console.log(`最終行: ${lastRow}`);

    // 処理行数を制限（パフォーマンス対策）
    const maxRowsToCheck = Math.min(lastRow, 1000);
    console.log(`チェック対象行数: ${maxRowsToCheck}`);

    const aqColumn = 43; // AQ列
    const checkedRows: number[] = [];

    console.log('チェックボックス値の確認開始...');
    for (let row = 2; row <= maxRowsToCheck; row++) {
      try {
        const checkboxValue = sheet.getRange(row, aqColumn).getValue();
        if (checkboxValue === true) {
          checkedRows.push(row);
        }
      } catch (error) {
        console.warn(`${row}行目のチェックボックス読み取りエラー:`, error);
        // 個別行のエラーは無視して続行
      }
    }

    console.log(`チェック済み行: ${checkedRows.length}行`, checkedRows);
    return checkedRows.filter((row): row is number => typeof row === 'number');
  } catch (error) {
    console.error('getCheckedRows()全体エラー:', error);
    return []; // 空配列を返す
  }
}

/**
 * チェックされた行数を取得
 */
function getCheckedRowsCount(): number {
  try {
    console.log('getCheckedRows()実行中...');
    const rows = getCheckedRows();
    console.log(`getCheckedRows()完了: ${rows.length}行`);
    return rows.length;
  } catch (error) {
    console.error('getCheckedRows()エラー:', error);
    return 0;
  }
}

/**
 * MAX_COUNT設定値を取得
 */
function getMaxCountSetting(): number {
  try {
    console.log('PropertiesService.getScriptProperties()実行中...');
    const properties = PropertiesService.getScriptProperties();
    console.log('プロパティサービス取得完了');

    console.log('MAX_COUNTプロパティ取得中...');
    const maxCountStr = properties.getProperty('MAX_COUNT');
    console.log(`MAX_COUNTプロパティ値: "${maxCountStr}"`);

    if (!maxCountStr) {
      console.log('MAX_COUNTが未設定、デフォルト値10を使用');
      return 10;
    }

    const parsed = parseInt(maxCountStr, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.log(`MAX_COUNTの値が無効: "${maxCountStr}", デフォルト値10を使用`);
      return 10;
    }

    console.log(`MAX_COUNT設定値: ${parsed}`);
    return parsed;
  } catch (error) {
    console.error('getMaxCountSetting()エラー:', error);
    return 10; // デフォルト値
  }
}

