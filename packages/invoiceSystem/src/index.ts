import type { InvoiceData } from "./types";
import { SHEET_NAME, COLUMN_MAPPING } from "./env";
// biome-ignore lint/suspicious/noExplicitAny: GASのグローバル変数を使用する必要があるため
declare let global: any;

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('シートが見つかりません');

    const data = JSON.parse(e.postData.contents) as InvoiceData;

    // 数量×単価を計算
    const 数量 = parseFloat(data.数量) || 0;
    const 単価 = parseFloat(data.単価) || 0;
    const 金額 = 数量 * 単価;

    // L列（請求書番号列）に値が入っている最後の行を基準に次の行を取得
    const columnLValues = sheet.getRange(1, COLUMN_MAPPING.請求書番号, sheet.getMaxRows(), 1).getValues();
    let lastRowWithData = 0;
    
    // 最後の非空白行を逆順で検索
    for (let i = columnLValues.length - 1; i >= 0; i--) {
      if (columnLValues[i][0] && columnLValues[i][0].toString().trim() !== '') {
        lastRowWithData = i + 1;
        break;
      }
    }
    
    const targetRow = lastRowWithData + 1;

    // 指定された列のみに値を設定
    sheet.getRange(targetRow, COLUMN_MAPPING.請求日).setValue(data.請求日);
    sheet.getRange(targetRow, COLUMN_MAPPING.請求書番号).setValue(data.請求書番号);
    sheet.getRange(targetRow, COLUMN_MAPPING.住所).setValue(data['住所・担当者'] || '');
    sheet.getRange(targetRow, COLUMN_MAPPING.入金締切日).setValue(data.入金締切日);
    sheet.getRange(targetRow, COLUMN_MAPPING.備考).setValue(data.備考 || '');

    // Freee API用データを保持（ログ出力）
    console.log('Freee API用データ:', {
      顧客名: data.顧客名,
      件名: data.件名,
      摘要: data.摘要,
      数量: data.数量,
      単価: data.単価,
      金額計算: 金額
    });

    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error(error);
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);
  }


}
global.doPost = doPost; // これがないと、doPostが呼び出されない
