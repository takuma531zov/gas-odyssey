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

    // デバッグ用ログ
    console.log('書き込み対象行:', targetRow);
    console.log('受信データ:', data);
    console.log('列マッピング:', COLUMN_MAPPING);

    // 指定された列のみに値を設定
    sheet.getRange(targetRow, COLUMN_MAPPING.請求日).setValue(data.請求日);
    sheet.getRange(targetRow, COLUMN_MAPPING.請求書番号).setValue(data.請求書番号);
    sheet.getRange(targetRow, COLUMN_MAPPING.入金締切日).setValue(data.入金締切日 || '');
    sheet.getRange(targetRow, COLUMN_MAPPING.備考).setValue(data.備考 || '');
    
    // 新規列の出力をデバッグ
    console.log('摘要書き込み - 列:', COLUMN_MAPPING.摘要, '値:', data.摘要);
    sheet.getRange(targetRow, COLUMN_MAPPING.摘要).setValue(data.摘要 || '');
    
    console.log('数量書き込み - 列:', COLUMN_MAPPING.数量, '値:', data.数量);
    sheet.getRange(targetRow, COLUMN_MAPPING.数量).setValue(data.数量 || '');
    
    console.log('単価書き込み - 列:', COLUMN_MAPPING.単価, '値:', data.単価);
    sheet.getRange(targetRow, COLUMN_MAPPING.単価).setValue(data.単価 || '');

    // X列にプルダウンを設定（未生成がデフォルト）
    console.log('ステータス書き込み - 列:', COLUMN_MAPPING.ステータス);
    console.log('シート最大列数:', sheet.getMaxColumns());
    
    // まず値を設定してから検証
    const statusCell = sheet.getRange(targetRow, COLUMN_MAPPING.ステータス);
    console.log('ステータスセル範囲:', statusCell.getA1Notation());
    
    statusCell.setValue('未生成');
    console.log('ステータス値設定完了');
    
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['未生成', '生成済み'])
      .setAllowInvalid(false)
      .build();
    statusCell.setDataValidation(rule);
    console.log('プルダウン設定完了');

    // Freee API用データを保持（ログ出力）- 登録日時以外の全データ
    const freeeApiData = {
      請求日: data.請求日,
      請求書番号: data.請求書番号,
      顧客名: data.顧客名,
      入金締切日: data.入金締切日,
      件名: data.件名,
      摘要: data.摘要,
      数量: data.数量,
      単価: data.単価,
      備考: data.備考
    };
    console.log('Freee API用データ:', freeeApiData);

    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error(error);
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);
  }


}

// テスト用関数（デバッグ用）
function testDoPost() {
  const testData = {
    請求日: '8/7',
    請求書番号: '3456789-4567',
    顧客名: 'ertyuiofgh',
    件名: 'fghj',
    摘要: 'ertyui',
    数量: '567',
    単価: '34567',
    備考: '',
    入金締切日: '2025-09-30',
    登録日時: '2025-07-18T13:32:36.653Z'
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  return doPost(mockEvent as GoogleAppsScript.Events.DoPost);
}

global.doPost = doPost; // これがないと、doPostが呼び出されない
global.testDoPost = testDoPost; // テスト用関数もグローバルに登録
