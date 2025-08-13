/**
 * スプレッドシートUI制御メインファイル
 * 既存ロジックに一切影響を与えず、UI層のみを追加
 */

// 型定義のみをインポート
import type { ContactPageResult } from '../types/interfaces';

/**
 * スプレッドシートボタンから実行されるメインエントリーポイント
 * ユーザーに実行オプションを選択させ、適切な処理を実行
 */
export function executeUrlFinderWithUI(): void {
  console.log('=== URLFinder UI 開始 ===');
  
  try {
    // 実行オプション選択ダイアログを表示
    showExecutionOptionsDialog();
    
  } catch (error) {
    console.error('UI実行エラー:', error);
    showErrorDialog(`実行中にエラーが発生しました: ${error}`);
  }
}

/**
 * 実行オプション選択ダイアログを表示
 */
function showExecutionOptionsDialog(): void {
  const htmlTemplate = HtmlService.createTemplateFromFile('simple-options');
  
  // チェック行数を事前取得して渡す
  const checkedCount = getCheckedRowsCount();
  const maxCount = getMaxCountSetting();
  
  htmlTemplate.checkedCount = checkedCount;
  htmlTemplate.maxCount = maxCount;
  
  const htmlOutput = htmlTemplate.evaluate()
    .setWidth(450)
    .setHeight(320)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  SpreadsheetApp.getUi()
    .showModalDialog(htmlOutput, 'URLFinder - 実行オプション');
}

/**
 * 選択されたオプションに基づいて処理を実行
 * @param mode 'normal' | 'checked'
 */
export function executeSelectedMode(mode: string): void {
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
 * MAX_COUNT設定に基づいて処理を実行
 */
function executeNormalProcessing(): void {
  console.log('=== 通常処理開始 ===');
  
  try {
    // プログレスダイアログ表示
    showProgressDialog('通常処理', 'MAX_COUNT設定に基づいて処理中...');
    
    // 既存のprocessContactPageFinder()関数を呼び出し
    // 注意: この関数は../index.tsで定義されているが、exportされていないため
    // 一旦、既存ロジックを模倣した実装を行う
    executeNormalProcessingLogic();
    
    // 完了ダイアログ表示
    showCompletionDialog('通常処理が完了しました');
    
  } catch (error) {
    console.error('通常処理エラー:', error);
    showErrorDialog(`通常処理中にエラーが発生しました: ${error}`);
  }
}

/**
 * チェック行のみ処理（新機能）
 * AQ列でチェックされた行のみを処理
 */
function executeCheckedRowsProcessing(): void {
  console.log('=== チェック行処理開始 ===');
  
  try {
    const checkedRows = getCheckedRows();
    
    if (checkedRows.length === 0) {
      SpreadsheetApp.getUi().alert('チェックされた行がありません。');
      return;
    }
    
    // プログレスダイアログ表示
    showProgressDialog('チェック行処理', `${checkedRows.length}行を処理中...`);
    
    // 各チェック行を順次処理
    let successCount = 0;
    let failureCount = 0;
    
    for (const rowNumber of checkedRows) {
      try {
        // L列からURL取得
        const url = getUrlFromRow(rowNumber);
        
        if (!url || typeof url !== 'string' || url.trim() === '') {
          console.log(`${rowNumber}行目: URLが空です`);
          continue;
        }
        
        console.log(`${rowNumber}行目を処理中: ${url}`);
        
        // index.tsのfindContactPage関数を直接呼び出し
        const result: ContactPageResult = (globalThis as any).findContactPage(url);
        
        // AP列に結果を書き込み
        writeResultToSheet(rowNumber, result);
        
        if (result.contactUrl) {
          successCount++;
        } else {
          failureCount++;
        }
        
        // プログレス更新（インデックス不要なので省略）
        // updateProgress(currentIndex, checkedRows.length, successCount, failureCount);
        
      } catch (error) {
        console.error(`${rowNumber}行目の処理でエラー:`, error);
        failureCount++;
      }
    }
    
    // 完了ダイアログ表示
    showCompletionDialog(`チェック行処理が完了しました。成功: ${successCount}件、失敗: ${failureCount}件`);
    
  } catch (error) {
    console.error('チェック行処理エラー:', error);
    showErrorDialog(`チェック行処理中にエラーが発生しました: ${error}`);
  }
}

/**
 * 通常処理のロジック実装（既存ロジックを模倣）
 */
function executeNormalProcessingLogic(): void {
  const sheet = SpreadsheetApp.getActiveSheet();
  const properties = PropertiesService.getScriptProperties();
  
  // スクリプトプロパティから設定値を取得
  const maxCountStr = properties.getProperty('MAX_COUNT');
  const headerRowStr = properties.getProperty('HEADER_ROW');
  
  const maxCount = maxCountStr ? parseInt(maxCountStr, 10) : 10;
  const headerRow = headerRowStr ? parseInt(headerRowStr, 10) : 2;
  
  console.log(`通常処理設定 - MAX_COUNT: ${maxCount}, HEADER_ROW: ${headerRow}`);
  
  // AP列の最終行を見つけて開始位置を決定
  const apColumn = 42; // AP列
  const lastRow = sheet.getLastRow();
  
  let startRow = headerRow;
  for (let row = headerRow; row <= lastRow; row++) {
    const cellValue = sheet.getRange(row, apColumn).getValue();
    if (cellValue && cellValue.toString().trim() !== '') {
      startRow = row + 1; // 次の行から開始
    }
  }
  
  console.log(`処理開始行: ${startRow}`);
  
  // 指定行数分を処理
  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  
  for (let row = startRow; row < startRow + maxCount; row++) {
    try {
      // L列からURL取得
      const url = getUrlFromRow(row);
      
      if (!url || typeof url !== 'string' || url.trim() === '') {
        continue;
      }
      
      console.log(`${row}行目を処理中: ${url}`);
      
      // index.tsのfindContactPage関数を直接呼び出し
      const result: ContactPageResult = (globalThis as any).findContactPage(url);
      
      // AP列に結果を書き込み
      writeResultToSheet(row, result);
      
      if (result.contactUrl) {
        successCount++;
      } else {
        failureCount++;
      }
      
      processedCount++;
      
      // プログレス更新
      updateProgress(processedCount, maxCount, successCount, failureCount);
      
    } catch (error) {
      console.error(`${row}行目の処理でエラー:`, error);
      failureCount++;
    }
  }
  
  console.log(`通常処理完了 - 処理: ${processedCount}件、成功: ${successCount}件、失敗: ${failureCount}件`);
}

/**
 * 指定行のL列からURLを取得
 * @param rowNumber 行番号
 * @returns URL文字列
 */
function getUrlFromRow(rowNumber: number): string {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lColumn = 12; // L列
  
  const cellValue = sheet.getRange(rowNumber, lColumn).getValue();
  return cellValue ? cellValue.toString().trim() : '';
}

/**
 * 結果をAP列に書き込み
 * @param rowNumber 行番号
 * @param result 検索結果
 */
function writeResultToSheet(rowNumber: number, result: ContactPageResult): void {
  const sheet = SpreadsheetApp.getActiveSheet();
  const apColumn = 42; // AP列
  
  const resultText = result.contactUrl || '見つかりませんでした';
  sheet.getRange(rowNumber, apColumn).setValue(resultText);
}

/**
 * AQ列でチェックされた行番号一覧を取得
 * @returns チェックされた行番号の配列
 */
function getCheckedRows(): number[] {
  const sheet = SpreadsheetApp.getActiveSheet();
  const aqColumn = 43; // AQ列
  const lastRow = sheet.getLastRow();
  
  const checkedRows: number[] = [];
  
  for (let row = 2; row <= lastRow; row++) {
    const checkboxValue = sheet.getRange(row, aqColumn).getValue();
    if (checkboxValue === true) {
      checkedRows.push(row);
    }
  }
  
  console.log(`チェック済み行: ${checkedRows.length}行`, checkedRows);
  return checkedRows;
}

/**
 * チェックされた行数を取得
 * @returns チェック行数
 */
function getCheckedRowsCount(): number {
  return getCheckedRows().length;
}

/**
 * MAX_COUNT設定値を取得
 * @returns MAX_COUNT値
 */
function getMaxCountSetting(): number {
  const properties = PropertiesService.getScriptProperties();
  const maxCountStr = properties.getProperty('MAX_COUNT');
  return maxCountStr ? parseInt(maxCountStr, 10) : 10;
}

/**
 * プログレスダイアログを表示
 * @param title タイトル
 * @param message メッセージ
 */
function showProgressDialog(title: string, message: string): void {
  const htmlTemplate = HtmlService.createTemplateFromFile('progress');
  htmlTemplate.title = title;
  htmlTemplate.message = message;
  
  const htmlOutput = htmlTemplate.evaluate()
    .setWidth(400)
    .setHeight(250)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  SpreadsheetApp.getUi()
    .showModalDialog(htmlOutput, 'URLFinder - 処理中');
}

/**
 * プログレス更新
 * @param current 現在の処理数
 * @param total 総処理数
 * @param success 成功数
 * @param failure 失敗数
 */
function updateProgress(current: number, total: number, success: number, failure: number): void {
  // 実際のプログレス更新は複雑なため、一旦ログ出力のみ
  console.log(`進捗: ${current}/${total} (成功: ${success}, 失敗: ${failure})`);
}

/**
 * 完了ダイアログを表示
 * @param message 完了メッセージ
 */
function showCompletionDialog(message: string): void {
  SpreadsheetApp.getUi().alert('処理完了', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * エラーダイアログを表示
 * @param message エラーメッセージ
 */
function showErrorDialog(message: string): void {
  SpreadsheetApp.getUi().alert('エラー', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * HTMLファイルの内容を取得（GAS用ヘルパー）
 * @param filename ファイル名
 * @returns HTML内容
 */
export function include(filename: string): string {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}