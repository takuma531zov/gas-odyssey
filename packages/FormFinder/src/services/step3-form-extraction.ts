import { SpreadsheetService } from './spreadsheet';
import { SimpleFormParser } from './SimpleFormParser';
import { FormStructure } from '../types';
import { Logger } from '../utils/logger';

/**
 * Step3: フォーム要素抽出 + スプレッドシート出力サービス
 * 目的: 取得したHTMLから<form>要素を抽出し結果を保存
 * 処理内容:
 * - HTMLから<form>要素を抽出
 * - フォーム構造データをJSON化
 * - 1行ずつスプレッドシートに出力
 * - 次の行の処理へ移行
 */
export class Step3FormExtractionService {
  private spreadsheetService: SpreadsheetService;
  private simpleFormParser: SimpleFormParser;

  constructor() {
    this.spreadsheetService = new SpreadsheetService();
    this.simpleFormParser = new SimpleFormParser();
  }

  /**
   * Step3実行: フォーム要素抽出 + スプレッドシート出力
   */
  execute(row: number, formUrl: string, html: string): boolean {
    Logger.debug(`Step3開始: フォーム要素抽出 + スプレッドシート出力 - ${formUrl}`);
    
    try {
      // SimpleFormParserに処理を委譲（送信要素検出ベース）
      const formStructure = this.simpleFormParser.parseFormStructure(html, formUrl);
      
      // <form>要素が見つからない場合はfalseを返す
      if (!formStructure) {
        Logger.warn(`Step3失敗: <form>要素が見つかりませんでした - ${formUrl}`);
        return false;
      }
      
      // SimpleFormParserに問い合わせフォーム判定を委譲（送信要素検出ベース）
      const isContactForm = this.simpleFormParser.isContactRelatedForm(html, formStructure, formUrl);
      
      // フォームは常に出力する
      this.spreadsheetService.saveResult(row, formUrl, formStructure);
      
      if (!isContactForm) {
        // 問い合わせフォームでない可能性がある場合は警告エラーを設定
        this.spreadsheetService.saveErrorStatus(row, "問い合わせフォームではない可能性あり", "red");
        Logger.warn(`Step3警告: 問い合わせフォームではない可能性があります - ${formUrl}`);
      }
      
      Logger.info(`Step3完了: ${row}行目に結果を保存しました`);
      return true;
      
    } catch (error) {
      Logger.error(`Step3エラー: フォーム要素抽出中にエラーが発生 - ${formUrl}`, error);
      throw error;
    }
  }

  /**
   * フォーム構造のみ保存（URLなしの場合）
   */
  saveFormStructureOnly(row: number, html: string, baseUrl: string): FormStructure | null {
    Logger.debug(`フォーム構造のみ抽出: ${baseUrl}`);
    
    try {
      return this.simpleFormParser.parseFormStructure(html, baseUrl);
    } catch (error) {
      Logger.error(`フォーム構造抽出エラー: ${baseUrl}`, error);
      return null;
    }
  }

  // =====================================================
  // 重複処理削除完了
  // 上記の処理はSimpleFormParserに移管済み
  // =====================================================
}