import { Environment } from './env';
import type { ContactPageResult } from './types/interfaces';
// Navigation、SPA、Form検出機能はHtmlAnalyzerが内部で使用
import { NetworkUtils } from './utils/NetworkUtils';
import { HtmlAnalyzer } from './analyzers/HtmlAnalyzer';
import { CandidateManager } from './core/CandidateManager';
import { PatternSearcher } from './core/PatternSearcher';
import { SpreadsheetProcessor } from './processors/SpreadsheetProcessor';

/**
 * ContactPageFinder - BtoB営業用問い合わせページ自動検索システム
 *
 * 目的:
 * - 企業サイトから問い合わせページを自動発見
 * - Google Apps Script環境での安定動作
 * - BtoB営業活動の効率化支援
 *
 * 検索戦略:
 * Step1: URLパターン推測（高速・高精度）
 * Step2: HTML解析によるフォールバック検索
 * Final: 最終フォールバック（Step1の200 OKページ使用）
 *
 * 特徴:
 * - SPA（Single Page Application）対応
 * - Google Forms検出
 * - 埋め込みフォーム対応
 * - JavaScript動的フォーム検出
 * - タイムアウト管理による安定性確保
 */
class ContactPageFinder {
  // モジュール分離完了: 主要機能は特化モジュールに移植済み
  // CandidateManager(候補管理), HtmlAnalyzer(解析), PatternSearcher(検索),
  // NetworkUtils(通信), FormDetector(フォーム検出)に分離



  // HIGH_PRIORITY_PATTERNS moved to HtmlAnalyzer





  // getFinalFallbackUrlはCandidateManagerに移植済み

  // evaluateFallbackUrlQualityはCandidateManagerに移植済み


  // 早期終了用の閾値定義とタイムアウト設定は env.ts で管理





  // FORM_KEYWORDS moved to HtmlAnalyzer



  /**
   * 問い合わせページ検索のメインエントリーポイント
   *
   * @param baseUrl 検索対象のベースURL（企業サイトのトップページ等）
   * @returns ContactPageResult 検索結果（URL、フォーム情報、検索手法等）
   *
   * 処理フロー:
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
      // 候補リストのリセット（新しい検索開始時）
      CandidateManager.resetCandidates();

      // SNSページの検出
      if (NetworkUtils.isSNSPage(baseUrl)) {
        console.log(`SNS page detected: ${baseUrl}, returning not found`);
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: ['sns_page'],
          searchMethod: 'sns_not_supported'
        };
      }

      // ドメイン生存確認
      console.log(`Checking domain availability for: ${baseUrl}`);
      const domainCheck = NetworkUtils.checkDomainAvailability(baseUrl);
      if (!domainCheck.available) {
        console.log(`Domain unavailable: ${domainCheck.error}`);
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: [domainCheck.error || 'サイトが閉鎖されています'],
          searchMethod: 'site_closed'
        };
      }
      console.log(`Domain is available, proceeding with contact search`);

      // Extract domain for subdirectory pattern support
      const domainUrl = NetworkUtils.extractDomain(baseUrl);

      console.log(`Starting contact page search for: ${baseUrl}`);

      // STEP 1: URL pattern guessing with integrated SPA detection (HIGHEST PRIORITY - Fast & Accurate)
      console.log('Step 1: URL pattern guessing with SPA optimization (primary strategy)');
      const priorityResult = PatternSearcher.searchWithPriorityPatterns(domainUrl, startTime);
      if (priorityResult.contactUrl) {
        console.log(`✅ Found via URL pattern search: ${priorityResult.contactUrl}`);
        return priorityResult;
      }

      // エラーの場合は即座に返す（fallback処理をスキップ）
      if (priorityResult.searchMethod === 'dns_error' || priorityResult.searchMethod === 'bot_blocked') {
        console.log(`URL pattern search returned error: ${priorityResult.searchMethod}, stopping here`);
        return priorityResult;
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
        const response = NetworkUtils.fetchWithTimeout(baseUrl, 7000); // 7秒タイムアウト
        const html = NetworkUtils.getContentWithEncoding(response); // 🔥 文字化け解決

        // Check for Google Forms URLs first
        const googleFormUrls = NetworkUtils.findGoogleFormUrlsOnly(html);
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
        const result = HtmlAnalyzer.analyzeHtmlContent(html, baseUrl);

        // If we found a contact page, try to find the actual form within it
        if (result.contactUrl) {
          console.log(`Found contact link on homepage: ${result.contactUrl}`);
          const formUrl = HtmlAnalyzer.findActualForm(result.contactUrl);
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
        const embeddedFormResult = NetworkUtils.findEmbeddedHTMLForm(html);
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
        const detailedError = NetworkUtils.getDetailedNetworkError(homepageError);
        console.log(`Error in homepage analysis fallback: ${detailedError}`);
      }

      // FINAL FALLBACK: Return first valid contact URL from Step1 if available
      console.log('All search methods failed, checking final fallback...');
      const fallbackResult = CandidateManager.getFinalFallbackUrl();
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
      const detailedError = NetworkUtils.getDetailedNetworkError(error);
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
   * Step2フロー: ホームページHTML解析によるフォールバック検索
   *
   * 処理手順:
   * 1. Google Forms最優先検索（HTML内のdocs.google.com URL検出）
   * 2. 埋め込みフォーム検証（外部サービス: Form.run, HubSpot等）
   * 3. ナビゲーション内リンク解析（<nav>要素、メニュー系クラス解析）
   * 4. リンク先フォーム検証（発見したリンクの実際の内容確認）
   * 5. 重複回避処理（Step1成功URLとの重複チェック）
   *
   * 検索範囲:
   * - Navigation（<nav>、.menu、.navigation等）
   * - Header内のリスト構造（<header><ul>構造）
   * - グローバルナビゲーション（.global-nav、.site-nav等）
   *
   * 特別処理:
   * - アンカーリンク特別処理（#contact等の内部リンク）
   * - JavaScript無効環境でのフォーム検出
   * - 動的コンテンツの静的解析
   *
   * 品質保証:
   * - キーワードマッチング重み付けスコア
   * - コンテキストボーナス（navigation内 +5点）
   * - 早期終了による高信頼度結果優先
   */
  // analyzeHtmlContentはHtmlAnalyzer.analyzeHtmlContentに完全移植済み


  // 200 OK URLsの評価（キーワード検出による問い合わせページ判定）








  // 🔥 文字化け解決: 複数エンコーディング試行


  // 動的サイト用厳格キーワード検証


  // 移植済み関数: findActualForm, detectGoogleForms, logPotentialCandidate, 
  // calculateCandidateScore, resetCandidatesは各モジュールに移植完了

  /**
   * Step1フロー: URLパターン推測による高速検索
   *
   * 処理手順:
   * 1. 優先URLパターンテスト (/contact/ → /contact → /inquiry/ → ...)
   * 2. 各URLでHTTP通信実行（200 OK確認）
   * 3. SPA検出（同一HTML判定による単一ページアプリ識別）
   * 4. 構造化フォーム検証（<form>要素 + 送信ボタン検証）
   * 5. Google Forms検証（docs.google.com URLパターン）
   * 6. アンカー分析（SPA対応: #contact等の内部リンク解析）
   * 7. 成功時即座に結果返却、失敗時は200 OK URLを記録
   *
   * SPA対応機能:
   * - 同一HTMLハッシュ検出による動的ページ判定
   * - アンカーリンク（#hash）の内容分析
   * - セクション内フォーム検証
   *
   * パフォーマンス最適化:
   * - 高信頼度パターンから優先実行
   * - 成功時の早期終了
   * - タイムアウト管理による無限ループ防止
   */
  // searchWithPriorityPatternsはPatternSearcherに移植済み

  // isValidContactPageはHtmlAnalyzerに移植済み

  // getDetailedErrorMessageはPatternSearcherに移植済み
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

/**
 * スプレッドシートUI付きURLFinder実行関数
 * GAS上のスプレッドシートボタンから実行される
 */
function executeUrlFinderWithUI(): void {
  console.log('=== URLFinder UI 開始 ===');

  try {
    // チェック行数を取得
    const checkedCount = getCheckedRowsCount();
    const maxCount = SpreadsheetProcessor.getMaxCountSetting();

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


declare const global: any;

global.executeUrlFinderWithUI = executeUrlFinderWithUI;

global.processContactPageFinder = processContactPageFinder;
