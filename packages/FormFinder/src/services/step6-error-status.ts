import { SpreadsheetService } from './spreadsheet';
import { Logger } from '../utils/logger';

/**
 * Step6: エラーステータス出力サービス
 * 目的: フォームが見つからない場合のステータス記録
 * 処理内容:
 * - AT列にエラーステータスを出力
 * - AP列セルの背景色を変更（エラー表示）
 */
export class Step6ErrorStatusService {
  private spreadsheetService: SpreadsheetService;

  constructor() {
    this.spreadsheetService = new SpreadsheetService();
  }

  /**
   * Step6実行: エラーステータス出力
   */
  execute(row: number, errorMessage: string, backgroundColor: "red" | "grey" = "grey"): void {
    Logger.info(`Step6開始: エラーステータス出力 - ${row}行目`);
    
    try {
      this.spreadsheetService.saveErrorStatus(row, errorMessage, backgroundColor);
      Logger.info(`Step6完了: ${row}行目のエラーステータス保存完了`);
      
    } catch (error) {
      Logger.error(`Step6エラー: エラーステータス保存中にエラーが発生 - ${row}行目`, error);
      throw error;
    }
  }

  /**
   * 標準エラーメッセージでエラーステータス出力
   */
  executeWithStandardMessage(row: number): void {
    this.execute(row, '問い合わせページが見つかりませんでした', 'grey');
  }

  /**
   * 処理エラー用のエラーステータス出力
   */
  executeForProcessingError(row: number): void {
    this.execute(row, '処理中にエラーが発生しました', 'grey');
  }

  /**
   * トップページアクセス不可用のエラーステータス出力
   */
  executeForTopPageError(row: number): void {
    this.execute(row, 'トップページにアクセスできませんでした', 'grey');
  }

  /**
   * 詳細エラー情報付きトップページエラー出力
   */
  executeForTopPageErrorWithDetail(row: number, errorDetail: string): void {
    this.execute(row, errorDetail, 'grey');
  }
}