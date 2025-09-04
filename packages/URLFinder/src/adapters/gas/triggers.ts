import { Environment } from '../../env';
import { findContactPage } from '../../findContactPage';

/**
 * 1つのURLを処理し、スプレッドシートに出力する文字列を生成する
 * @param url 処理対象のURL
 * @param currentRow 現在の行番号
 * @param headerRow ヘッダー行の番号
 * @returns スプレッドシートに書き込むための単一要素の配列
 */
function processSingleUrl(url: string, currentRow: number, headerRow: number): [string] {
  if (!url || url.trim() === '') {
    return [''];
  }
  if (currentRow === headerRow) {
    console.log(`${currentRow}行目: ヘッダー行のためスキップ`);
    return [''];
  }

  console.log(`${currentRow}行目: ${url} を処理中...`);

  try {
    const result = findContactPage(url.trim());
    console.log(
      `Result for ${currentRow}行目: searchMethod=${result.searchMethod}, foundKeywords=${(
        result.foundKeywords ? result.foundKeywords.join(',') : 'none'
      )}`
    );

    // エラー条件のチェック
    const errorMethods = ['error', 'dns_error', 'bot_blocked', 'site_closed', 'timeout_error'];
    if (errorMethods.includes(result.searchMethod)) {
      const errorMessage = result.foundKeywords?.[0] || 'エラーが発生しました';
      console.log(`${currentRow}行目: 完了 - ${errorMessage}`);
      return [errorMessage];
    }

    // actualFormUrl がある場合
    if (result.actualFormUrl) {
      const outputValue = result.actualFormUrl.startsWith('http')
        ? result.actualFormUrl
        : (result.contactUrl || url.trim());
      console.log(`${currentRow}行目: 完了 - ${outputValue}`);
      return [outputValue];
    }

    // contactUrl がある場合
    if (result.contactUrl) {
      console.log(`${currentRow}行目: 完了 - ${result.contactUrl}`);
      return [result.contactUrl];
    }

    // 上記いずれにも当てはまらない場合
    const notFoundMessage = '問い合わせフォームが見つかりませんでした';
    console.log(`${currentRow}行目: 完了 - ${notFoundMessage}`);
    return [notFoundMessage];

  } catch (error) {
    const errorMessage = `エラー: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`${currentRow}行目: ${errorMessage}`);
    return [errorMessage];
  }
}

export function processContactPageFinder() {
  const { getSheetName, getMaxCount, getHeaderRow, getTargetColumn, getBatchSize, getOutputColumn } = Environment;

  try {
    const sheetName = getSheetName();
    const maxCount = getMaxCount();
    const headerRow = getHeaderRow();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`シート「${sheetName}」が見つかりません`);
    }

    console.log(`処理上限: ${maxCount ? `${maxCount}行` : '制限なし'}`);
    console.log(`ヘッダー行: ${headerRow}行目（処理対象から除外）`);

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
    const targetColumn = getTargetColumn();
    const urlRange = sheet.getRange(startRow, targetColumn, endRow - startRow + 1, 1);
    const urls = urlRange.getValues();
    const batchSize = getBatchSize();
    console.log(`バッチサイズ設定: ${batchSize}`);

    let processedCount = 0;
    const outputColumn = getOutputColumn();

    // ★ その場チャンク処理：配列を事前に分割せず、オフセットで区切って処理
    for (let offset = 0; offset < urls.length; offset += batchSize) {
      const chunk = urls.slice(offset, offset + batchSize);
      const chunkStartRow = startRow + offset;

      const results = chunk.map((urlRow, indexInChunk) => {
        const urlValue = urlRow && urlRow[0];
        const url = String(urlValue || '');
        const currentRow = chunkStartRow + indexInChunk;
        return processSingleUrl(url, currentRow, headerRow);
      });

      if (results.length > 0) {
        const outputRange = sheet.getRange(chunkStartRow, outputColumn, results.length, 1);
        outputRange.setValues(results);

        processedCount += results.length;
        console.log(`中間出力完了: ${chunkStartRow}行目から${results.length}行を出力列に出力（バッチサイズ: ${batchSize}）`);
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