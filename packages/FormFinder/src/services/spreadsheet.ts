import { CompanyData, FormStructure } from '../types';
import { SPREADSHEET_COLUMNS } from '../utils/constants';
import { Logger } from '../utils/logger';
import { Environment } from '../utils/env';

export class SpreadsheetService {
  private sheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = Environment.SHEET_NAME;
    
    if (sheetName) {
      const targetSheet = spreadsheet.getSheetByName(sheetName);
      if (targetSheet) {
        this.sheet = targetSheet;
        Logger.info(`対象シート設定: ${sheetName}`);
      } else {
        Logger.error(`指定されたシート '${sheetName}' が見つかりません。アクティブシートを使用します。`);
        this.sheet = spreadsheet.getActiveSheet();
      }
    } else {
      Logger.info('シート名が未設定のため、アクティブシートを使用します');
      this.sheet = spreadsheet.getActiveSheet();
    }
    
    Logger.info(`使用シート: ${this.sheet.getName()}`);
  }

  getTargetRows(): CompanyData[] {
    Logger.info('対象行の抽出を開始');
    
    try {
      // AP列の最終データ行を取得
      const lastContactFormRow = this.getLastDataRow(SPREADSHEET_COLUMNS.CONTACT_FORM_URL);
      
      // L列の最終データ行を取得
      const lastHomepageRow = this.getLastDataRow(SPREADSHEET_COLUMNS.HOMEPAGE_URL);
      
      Logger.debug(`AP列最終行: ${lastContactFormRow}, L列最終行: ${lastHomepageRow}`);
      
      if (lastContactFormRow >= lastHomepageRow) {
        Logger.info('処理対象行がありません');
        return [];
      }

      const startRow = lastContactFormRow + 1;
      const endRow = lastHomepageRow;
      
      Logger.info(`処理対象行: ${startRow}行目から${endRow}行目まで (${endRow - startRow + 1}行)`);
      
      // バッチで対象範囲のURLを取得
      const homepageUrls = this.sheet
        .getRange(`${SPREADSHEET_COLUMNS.HOMEPAGE_URL}${startRow}:${SPREADSHEET_COLUMNS.HOMEPAGE_URL}${endRow}`)
        .getValues()
        .flat();

      const targetRows: CompanyData[] = [];
      
      for (let i = 0; i < homepageUrls.length; i++) {
        const url = homepageUrls[i];
        if (url && typeof url === 'string' && url.trim()) {
          targetRows.push({
            row: startRow + i,
            homepageUrl: url.trim()
          });
        }
      }
      
      Logger.info(`処理対象: ${targetRows.length}件`);
      return targetRows;
      
    } catch (error) {
      Logger.error('対象行抽出中にエラーが発生', error);
      return [];
    }
  }

  saveResults(results: { row: number; contactFormUrl?: string; formStructure?: FormStructure }[]): void {
    Logger.info(`結果保存開始: ${results.length}件`);
    
    if (results.length === 0) {
      Logger.warn('保存する結果がありません');
      return;
    }

    try {
      for (const result of results) {
        if (result.contactFormUrl) {
          this.sheet.getRange(`${SPREADSHEET_COLUMNS.CONTACT_FORM_URL}${result.row}`).setValue(result.contactFormUrl);
        }
        
        if (result.formStructure) {
          const jsonString = JSON.stringify(result.formStructure, null, 2);
          this.sheet.getRange(`${SPREADSHEET_COLUMNS.FORM_STRUCTURE}${result.row}`).setValue(jsonString);
        }
      }
      
      Logger.info('結果保存完了');
    } catch (error) {
      Logger.error('結果保存中にエラーが発生', error);
      throw error;
    }
  }

  /**
   * Step3 & Step6: 1行ずつスプレッドシート出力
   * 新仕様: 必ず1行ずつ即座に更新
   */
  saveResult(row: number, contactFormUrl?: string, formStructure?: FormStructure): void {
    Logger.info(`結果保存: ${row}行目`);
    
    try {
      // Step3: 問い合わせフォームURL出力
      if (contactFormUrl) {
        this.sheet.getRange(`${SPREADSHEET_COLUMNS.CONTACT_FORM_URL}${row}`).setValue(contactFormUrl);
        Logger.debug(`AP列${row}行目に保存: ${contactFormUrl}`);
      }
      
      // Step3: フォーム構造データ出力（JSON形式）
      if (formStructure) {
        const jsonString = JSON.stringify(formStructure, null, 2);
        this.sheet.getRange(`${SPREADSHEET_COLUMNS.FORM_STRUCTURE}${row}`).setValue(jsonString);
        Logger.debug(`AS列${row}行目に保存: フォーム構造データ`);
      }
      
      Logger.info(`${row}行目の結果保存完了`);
    } catch (error) {
      Logger.error(`${row}行目の結果保存中にエラーが発生`, error);
      throw error;
    }
  }

  /**
   * Step6: エラーステータス出力
   * AT列にエラーステータスを出力 + AP列背景色変更
   */
  saveErrorStatus(row: number, errorMessage: string, backgroundColor: "red" | "grey" = "grey"): void {
    Logger.info(`エラーステータス保存: ${row}行目 - ${errorMessage}`);
    
    try {
      // AT列にエラーステータス出力
      this.sheet.getRange(`${SPREADSHEET_COLUMNS.ERROR_STATUS}${row}`).setValue(errorMessage);
      
      // AP列の背景色を変更（エラータイプに応じて）
      const bgColor = backgroundColor === "red" ? '#ffcccc' : '#e0e0e0'; // 赤 or グレー
      this.sheet.getRange(`${SPREADSHEET_COLUMNS.CONTACT_FORM_URL}${row}`).setBackground(bgColor);
      
      Logger.info(`${row}行目のエラーステータス保存完了`);
    } catch (error) {
      Logger.error(`${row}行目のエラーステータス保存中にエラーが発生`, error);
      throw error;
    }
  }

  private getLastDataRow(column: string): number {
    try {
      // バッチ読み込みで高速化
      const values = this.sheet.getRange(`${column}:${column}`).getValues();
      
      if (values.length === 0) {
        return 0;
      }
      
      // 下から上に向かって空でない行を探す（メモリ上で処理）
      for (let i = values.length - 1; i >= 0; i--) {
        const cellValue = values[i]?.[0];
        if (cellValue && cellValue.toString().trim()) {
          const rowNumber = i + 1;
          Logger.debug(`${column}列の最終データ行: ${rowNumber}`);
          return rowNumber;
        }
      }
      
      return 0;
    } catch (error) {
      Logger.error(`${column}列の最終行取得でエラー`, error);
      return 0;
    }
  }

  getSpreadsheetId(): string {
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  }

  getSheetName(): string {
    return this.sheet.getName();
  }
}