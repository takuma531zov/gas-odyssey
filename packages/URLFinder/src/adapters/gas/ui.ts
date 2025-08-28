

import type { ContactPageResult } from '../../data/types/interfaces';
import { processContactPageFinder } from './triggers';
import { ContactPageFinder } from '../../contactPageFinder';
import { Environment } from '../../env';

function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}

/**
 * スプレッドシートUI付きURLFinder実行関数
 * GAS上のスプレッドシートボタンから実行される
 */
export function executeUrlFinderWithUI(): void {
  console.log('=== URLFinder UI 開始 ===');

  try {
    // チェック行数を取得
    const checkedCount = getCheckedRowsCount();
    const maxCount = getMaxCountSetting();

    // 実行オプション選択ダイアログを表示
    const htmlTemplate = HtmlService.createTemplateFromFile('simpleOptions');
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
        // 対象列からURL取得
        const url = getUrlFromRow(rowNumber!);

        if (!url || typeof url !== 'string' || url.trim() === '') {
          console.log(`${rowNumber}行目: URLが空です`);
          continue;
        }

        console.log(`${rowNumber}行目を処理中: ${url}`);

        // 既存のfindContactPage関数を使用
        const result: ContactPageResult = findContactPage(url);

        // 出力列に結果を書き込み
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
 * 指定行の対象列からURLを取得
 */
function getUrlFromRow(rowNumber: number): string {
  const sheet = SpreadsheetApp.getActiveSheet();
  const targetColumn = Environment.getTargetColumn();

  const cellValue = sheet.getRange(rowNumber, targetColumn).getValue();
  return cellValue ? cellValue.toString().trim() : '';
}

/**
 * 結果を出力列に書き込み（既存ロジックと完全に一致）
 */
function writeResultToSheet(rowNumber: number, result: ContactPageResult): void {
  const sheet = SpreadsheetApp.getActiveSheet();
  const outputColumn = Environment.getOutputColumn();

  // 既存のprocessContactPageFinderと完全に同じロジック
  let outputValue = '';

  // エラーの場合はエラーメッセージを出力
  if (result.searchMethod === 'error' || result.searchMethod === 'dns_error' || result.searchMethod === 'bot_blocked' || result.searchMethod === 'site_closed' || result.searchMethod === 'timeout_error') {
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

  sheet.getRange(rowNumber, outputColumn).setValue(outputValue);
}

/**
 * チェック列でチェックされた行番号一覧を取得
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

    const checkColumn = Environment.getCheckColumn();
    const checkedRows: number[] = [];

    console.log('チェックボックス値の確認開始...');
    for (let row = 2; row <= maxRowsToCheck; row++) {
      try {
        const checkboxValue = sheet.getRange(row, checkColumn).getValue();
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
