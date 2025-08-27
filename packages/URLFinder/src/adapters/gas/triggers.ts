
import type { ContactPageResult } from '../../data/types/interfaces';
import { ContactPageFinder } from '../../ContactPageFinder';
import { Environment } from '../../env';

function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}

export function processContactPageFinder() {
  try {
    // スクリプトプロパティから設定値を取得
    const sheetName = Environment.getSheetName();
    const maxCount = Environment.getMaxCount();
    const headerRow = Environment.getHeaderRow();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`シート「${sheetName}」が見つかりません`);
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

    // 対象列のURLを一括取得
    const targetColumn = Environment.getTargetColumn();
    const urlRange = sheet.getRange(startRow, targetColumn, endRow - startRow + 1, 1);
    const urls = urlRange.getValues();

    // バッチ処理による中間出力
    // 理由: GASタイムアウト時の進捗保護 + 処理速度維持（1行ずつ出力の20-40倍高速）
    const batchSize = Environment.getBatchSize();
    console.log(`バッチサイズ設定: ${batchSize}`);
    const results = [];
    let processedCount = 0;

    // 各URLを処理
    for (let i = 0; i < urls.length; i++) {
      const urlRow = urls[i];
      const url = urlRow && urlRow[0];
      const currentRow = startRow + i;

      if (!url || url.toString().trim() === '') {
        results.push(['']);
      } else if (currentRow === headerRow) {
        // ヘッダー行の場合はスキップ
        console.log(`${currentRow}行目: ヘッダー行のためスキップ`);
        results.push(['']);
      } else {
        console.log(`${currentRow}行目: ${url} を処理中...`);

        try {
          const result = findContactPage(url.toString().trim());

          console.log(`Result for ${currentRow}行目: searchMethod=${result.searchMethod}, foundKeywords=${result.foundKeywords ? result.foundKeywords.join(',') : 'none'}`);

          // actualFormURLをチェックして出力値を決定
          let outputValue = '';

          // エラーの場合はエラーメッセージを出力
          if (result.searchMethod === 'error' || result.searchMethod === 'dns_error' || result.searchMethod === 'bot_blocked' || result.searchMethod === 'site_closed' || result.searchMethod === 'timeout_error') {
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

      // バッチサイズに達したら中間出力
      if (results.length >= batchSize || i === urls.length - 1) {
        if (results.length > 0) {
          const batchStartRow = startRow + processedCount;
          const outputColumn = Environment.getOutputColumn();
          const outputRange = sheet.getRange(batchStartRow, outputColumn, results.length, 1);
          outputRange.setValues(results);
          
          processedCount += results.length;
          console.log(`中間出力完了: ${batchStartRow}行目から${results.length}行を出力列に出力（バッチサイズ: ${batchSize}）`);
          
          results.length = 0; // 配列クリア
        }
      }
    }

    console.log(`処理完了: ${processedCount}行の結果を出力列に出力しました`);

    // MAX_COUNT制限で処理が打ち切られた場合の通知
    if (maxCount && processedCount === maxCount && startRow + maxCount - 1 < lastRowL) {
      console.log(`注意: MAX_COUNT(${maxCount})制限により処理を制限しました。残り${lastRowL - (startRow + maxCount - 1)}行のデータが未処理です。`);
    }

  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
    throw error;
  }
}
