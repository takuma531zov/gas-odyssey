import { SpreadsheetService } from './spreadsheet';
import { CompanyData } from '../types';
import { Logger } from '../utils/logger';
import { DEFAULT_CONFIG } from '../utils/constants';

/**
 * Step1: 対象リスト抽出サービス
 * 目的: 処理対象行の特定
 * 処理内容:
 * - AP列の最終データ行を取得
 * - AP列最終行+1からL列最終行までを処理対象とする
 * - 途中の空白行は無視して処理を継続
 */
export class Step1TargetListService {
  private spreadsheetService: SpreadsheetService;

  constructor() {
    this.spreadsheetService = new SpreadsheetService();
  }

  /**
   * Step1実行: 処理対象行の抽出
   */
  execute(): CompanyData[] {
    Logger.info('Step1開始: 対象リスト抽出');
    
    try {
      const targetRows = this.spreadsheetService.getTargetRows();
      
      if (targetRows.length === 0) {
        Logger.info('Step1完了: 処理対象がありません');
        return [];
      }

      // 処理件数制限
      const limitedRows = targetRows.slice(0, DEFAULT_CONFIG.MAX_PROCESSING_ROWS);
      
      if (targetRows.length > DEFAULT_CONFIG.MAX_PROCESSING_ROWS) {
        Logger.info(`Step1完了: 処理対象 ${targetRows.length}件中、${DEFAULT_CONFIG.MAX_PROCESSING_ROWS}件に制限して処理します`);
      } else {
        Logger.info(`Step1完了: 処理対象 ${targetRows.length}件を抽出しました`);
      }
      
      return limitedRows;
      
    } catch (error) {
      Logger.error('Step1エラー: 対象リスト抽出中にエラーが発生', error);
      throw error;
    }
  }
}