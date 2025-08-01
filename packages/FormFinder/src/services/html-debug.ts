import { Logger } from '../utils/logger';
import { Step1TargetListService } from './step1-target-list';

/**
 * HTMLデバッグサービス
 * 目的: HTML構造の詳細分析とログ出力
 * 
 * 機能:
 * - 指定URLのHTML構造を詳細分析
 * - スプレッドシート最終行のHTML構造を分析
 * - フォーム要素・Googleフォームリンクの検出
 * - HTML全体の出力
 */
export class HtmlDebugService {
  private readonly config = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    acceptLanguage: 'ja,ja-JP;q=0.9,en;q=0.8'
  };

  // =====================================================
  // パブリックメソッド - デバッグエントリーポイント
  // =====================================================

  /**
   * AP列最終行のURLのHTML構造を詳細出力
   */
  debugLastTargetRow(): void {
    try {
      // Step1のロジックを使用して対象行を取得
      const step1Service = new Step1TargetListService();
      const targetRows = step1Service.execute();
      
      if (targetRows.length === 0) {
        Logger.error('Step1で処理対象行が見つかりませんでした');
        return;
      }
      
      // 最後の対象行（最新の処理対象）を取得
      const lastTarget = targetRows[targetRows.length - 1];
      if (!lastTarget) {
        Logger.error('対象行の取得に失敗しました');
        return;
      }
      
      const targetRow = lastTarget.row;
      const targetUrl = lastTarget.homepageUrl;
      
      // AP列に問い合わせフォームURLがあるかチェック
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = spreadsheet.getActiveSheet();
      const contactFormUrl = sheet.getRange(`AP${targetRow}`).getValue();
      
      let actualUrl = targetUrl; // デフォルトは企業ホームページURL
      let urlSource = 'L列（企業URL）';
      
      // AP列に問い合わせフォームURLがある場合はそちらを優先
      if (contactFormUrl && typeof contactFormUrl === 'string' && contactFormUrl.trim()) {
        actualUrl = contactFormUrl.trim();
        urlSource = 'AP列（問い合わせフォームURL）';
      }
      
      Logger.info(`=== Step1対象行デバッグ ===`);
      Logger.info(`対象行: ${targetRow}行目`);
      Logger.info(`URL取得元: ${urlSource}`);
      Logger.info(`対象URL: ${actualUrl}`);
      
      // HTML構造分析を実行
      this.analyzeHtmlStructure(actualUrl);
      
      // AS列のフォーム構造データも確認
      const formDataCell = sheet.getRange(`AS${targetRow}`).getValue();
      if (formDataCell) {
        Logger.info(`=== AS列のフォーム構造データ ===`);
        Logger.info(formDataCell);
      }
      
      // AT列のエラーステータスも確認
      const errorStatusCell = sheet.getRange(`AT${targetRow}`).getValue();
      if (errorStatusCell) {
        Logger.info(`=== AT列のエラーステータス ===`);
        Logger.info(errorStatusCell);
      }
      
    } catch (error) {
      Logger.error(`HTML構造デバッグ中にエラーが発生`, error);
    }
  }

  /**
   * 指定URLのHTML構造を詳細出力
   */
  debugSpecificUrl(url: string): void {
    Logger.info(`HTML構造デバッグ開始: ${url}`);
    this.analyzeHtmlStructure(url);
  }

  // =====================================================
  // プライベートメソッド - HTML分析ロジック
  // =====================================================

  /**
   * HTML構造の詳細分析とログ出力
   */
  private analyzeHtmlStructure(url: string): void {
    try {
      // Step1: HTMLを取得
      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept-Language': this.config.acceptLanguage
        },
        muteHttpExceptions: true,
        followRedirects: true
      });
      
      const statusCode = response.getResponseCode();
      const html = response.getContentText();
      
      // Step2: HTTP情報をログ出力
      Logger.info(`=== HTTP情報 ===`);
      Logger.info(`ステータスコード: ${statusCode}`);
      Logger.info(`コンテンツサイズ: ${html.length}文字`);
      
      if (statusCode !== 200) {
        Logger.error(`HTTP ${statusCode}エラー`);
        return;
      }
      
      // Step3: 基本的なHTML要素を分析
      this.analyzeBasicElements(html);
      
      // Step4: フォーム要素の詳細分析
      this.analyzeFormElements(html);
      
      // Step5: Googleフォーム検出
      this.analyzeGoogleForms(html);
      
      // Step6: HTML全体を出力
      Logger.info(`=== HTML全体 (${html.length}文字) ===`);
      Logger.info(html);
      
      Logger.info(`HTML構造デバッグ完了: ${url}`);
      
    } catch (error) {
      Logger.error(`HTML構造デバッグ中にエラーが発生: ${url}`, error);
    }
  }

  /**
   * 基本的なHTML要素のカウント分析
   */
  private analyzeBasicElements(html: string): void {
    Logger.info(`=== HTML構造分析 ===`);
    
    const formCount = (html.match(/<form[^>]*>/gi) || []).length;
    const inputCount = (html.match(/<input[^>]*>/gi) || []).length;
    const textareaCount = (html.match(/<textarea[^>]*>/gi) || []).length;
    const selectCount = (html.match(/<select[^>]*>/gi) || []).length;
    const buttonCount = (html.match(/<button[^>]*>/gi) || []).length;
    
    Logger.info(`フォーム数: ${formCount}`);
    Logger.info(`input要素数: ${inputCount}`);
    Logger.info(`textarea要素数: ${textareaCount}`);
    Logger.info(`select要素数: ${selectCount}`);
    Logger.info(`button要素数: ${buttonCount}`);
  }

  /**
   * フォーム要素の詳細分析
   */
  private analyzeFormElements(html: string): void {
    const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi);
    
    if (!formMatches || formMatches.length === 0) {
      return;
    }

    Logger.info(`=== フォーム詳細分析 ===`);
    
    formMatches.forEach((formHtml, index) => {
      Logger.info(`--- フォーム ${index + 1} ---`);
      
      // action属性
      const actionMatch = formHtml.match(/action\s*=\s*["']([^"']*)/i);
      const action = actionMatch ? actionMatch[1] : '未設定';
      Logger.info(`action: ${action}`);
      
      // method属性
      const methodMatch = formHtml.match(/method\s*=\s*["']([^"']*)/i);
      const method = methodMatch ? methodMatch[1] : 'GET';
      Logger.info(`method: ${method}`);
      
      // input要素
      this.analyzeInputElements(formHtml);
      
      // textarea要素
      this.analyzeTextareaElements(formHtml);
      
      // submit button
      this.analyzeSubmitButtons(formHtml);
      
      Logger.info(`--- フォーム ${index + 1} 終了 ---`);
    });
  }

  /**
   * Input要素の分析
   */
  private analyzeInputElements(formHtml: string): void {
    const inputs = formHtml.match(/<input[^>]*>/gi) || [];
    Logger.info(`input数: ${inputs.length}`);
    
    inputs.forEach((input, i) => {
      const nameMatch = input.match(/name\s*=\s*["']([^"']*)/i);
      const typeMatch = input.match(/type\s*=\s*["']([^"']*)/i);
      const name = nameMatch ? nameMatch[1] : '未設定';
      const type = typeMatch ? typeMatch[1] : 'text';
      Logger.info(`  input[${i}]: name="${name}", type="${type}"`);
    });
  }

  /**
   * Textarea要素の分析
   */
  private analyzeTextareaElements(formHtml: string): void {
    const textareas = formHtml.match(/<textarea[^>]*>/gi) || [];
    
    if (textareas.length === 0) return;
    
    Logger.info(`textarea数: ${textareas.length}`);
    textareas.forEach((textarea, i) => {
      const nameMatch = textarea.match(/name\s*=\s*["']([^"']*)/i);
      const name = nameMatch ? nameMatch[1] : '未設定';
      Logger.info(`  textarea[${i}]: name="${name}"`);
    });
  }

  /**
   * Submit button要素の分析
   */
  private analyzeSubmitButtons(formHtml: string): void {
    const submitButtons = formHtml.match(/<input[^>]*type\s*=\s*["']submit[^>]*>|<button[^>]*type\s*=\s*["']submit[^>]*>|<button[^>]*>[^<]*<\/button>/gi) || [];
    
    if (submitButtons.length === 0) return;
    
    Logger.info(`送信ボタン数: ${submitButtons.length}`);
    submitButtons.forEach((button, i) => {
      const valueMatch = button.match(/value\s*=\s*["']([^"']*)/i);
      const textMatch = button.match(/<button[^>]*>([^<]*)<\/button>/i);
      const text = valueMatch ? valueMatch[1] : (textMatch ? textMatch[1] : '未設定');
      Logger.info(`  button[${i}]: "${text}"`);
    });
  }

  /**
   * Googleフォームリンクの検出・分析
   */
  private analyzeGoogleForms(html: string): void {
    const googleFormPatterns = ['docs.google.com/forms', 'forms.google.com', 'forms.gle', 'goo.gl/forms'];
    const googleFormLinks: string[] = [];
    
    for (const pattern of googleFormPatterns) {
      if (html.includes(pattern)) {
        const regex = new RegExp(`https?://[^\\s"'<>]*${pattern.replace('.', '\\.')}[^\\s"'<>]*`, 'gi');
        const matches = html.match(regex) || [];
        googleFormLinks.push(...matches);
      }
    }
    
    if (googleFormLinks.length > 0) {
      Logger.info(`=== Googleフォーム検出 ===`);
      Logger.info(`Googleフォームリンク数: ${googleFormLinks.length}`);
      googleFormLinks.forEach((link, i) => {
        Logger.info(`  [${i + 1}] ${link}`);
      });
    }
  }
}