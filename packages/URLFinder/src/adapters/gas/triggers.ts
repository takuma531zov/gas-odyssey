import { SCRIPT_PROPERTIES, DEFAULT_VALUES } from "../../env";
import {
  getScriptPropertyValue,
  columnNameToNumber,
} from "../../../../common/src/spreadsheet";
import { findContactPage } from "../../findContactPage";

/** 数値: NaN/未設定は default にフォールバック（非nullable） */
function numOrDefault(raw: string | null, def: number): number {
  const n = raw == null || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : def;
}
/** 数値: NaN/未設定は null（nullable用途: 例 MAX_COUNT） */
function numOrNull(raw: string | null): number | null {
  const n = raw == null || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * 1つのURLを処理し、スプレッドシートに出力する文字列を生成する
 * @param url 処理対象のURL
 * @param currentRow 現在の行番号
 * @param headerRow ヘッダー行の番号
 * @returns スプレッドシートに書き込むための単一要素の配列
 */
function processSingleUrl(
  url: string,
  currentRow: number,
  headerRow: number,
): [string] {
  if (!url || url.trim() === "") return [""];
  if (currentRow === headerRow) {
    console.log(`${currentRow}行目: ヘッダー行のためスキップ`);
    return [""];
  }

  console.log(`${currentRow}行目: ${url} を処理中...`);

  try {
    const result = findContactPage(url.trim());
    console.log(
      `Result for ${currentRow}行目: searchMethod=${result.searchMethod}, foundKeywords=${result.foundKeywords?.join(",") ?? "none"}`,
    );

    // エラー条件のチェック
    const ERROR_METHODS = [
      "error",
      "dns_error",
      "bot_blocked",
      "site_closed",
      "timeout_error",
    ] as const;
    if (
      ERROR_METHODS.includes(
        result.searchMethod as (typeof ERROR_METHODS)[number],
      )
    ) {
      const errorMessage = result.foundKeywords?.[0] || "エラーが発生しました";
      console.log(`${currentRow}行目: 完了 - ${errorMessage}`);
      return [errorMessage];
    }

    // actualFormUrl がある場合
    if (result.actualFormUrl) {
      const outputValue = result.actualFormUrl.startsWith("http")
        ? result.actualFormUrl
        : result.contactUrl || url.trim();
      console.log(`${currentRow}行目: 完了 - ${outputValue}`);
      return [outputValue];
    }

    // contactUrl がある場合
    if (result.contactUrl) {
      console.log(`${currentRow}行目: 完了 - ${result.contactUrl}`);
      return [result.contactUrl];
    }

    // 上記いずれにも当てはまらない場合
    const notFoundMessage = "問い合わせフォームが見つかりませんでした";
    console.log(`${currentRow}行目: 完了 - ${notFoundMessage}`);
    return [notFoundMessage];
  } catch (error) {
    const errorMessage = `エラー: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`${currentRow}行目: ${errorMessage}`);
    return [errorMessage];
  }
}

export function processContactPageFinder() {
  try {
    // ---- プロパティを一括取得（重複呼び出しを避ける） ----
    const props = {
      sheet: getScriptPropertyValue(SCRIPT_PROPERTIES.SHEET),
      maxCount: getScriptPropertyValue(SCRIPT_PROPERTIES.MAX_COUNT),
      headerRow: getScriptPropertyValue(SCRIPT_PROPERTIES.HEADER_ROW),
      targetCol: getScriptPropertyValue(SCRIPT_PROPERTIES.TARGET_COLUMN),
      batchSize: getScriptPropertyValue(SCRIPT_PROPERTIES.BATCH_SIZE),
      outputCol: getScriptPropertyValue(SCRIPT_PROPERTIES.OUTPUT_COLUMN),
    };

    // ---- プロパティの解決（数値は安全にフォールバック） ----
    const sheetName = props.sheet || DEFAULT_VALUES.SHEET;
    const maxCount = numOrNull(props.maxCount);
    const headerRow = numOrDefault(props.headerRow, DEFAULT_VALUES.HEADER_ROW);
    const batchSize = numOrDefault(props.batchSize, DEFAULT_VALUES.BATCH_SIZE);
    const targetColumn = props.targetCol
      ? columnNameToNumber(props.targetCol)
      : DEFAULT_VALUES.TARGET_COLUMN;
    const outputColumn = props.outputCol
      ? columnNameToNumber(props.outputCol)
      : DEFAULT_VALUES.OUTPUT_COLUMN;

    // ---- シート取得 ----
    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません`);

    console.log(`処理上限: ${maxCount ? `${maxCount}行` : "制限なし"}`);
    console.log(`ヘッダー行: ${headerRow}行目（処理対象から除外）`);

    // ---- 出力列の最終行を、プロパティに基づいて探索（AP固定を排除） ----
    const outputValues = sheet
      .getRange(1, outputColumn, sheet.getMaxRows(), 1)
      .getValues();
    let lastRowOutput = 0;
    for (let i = outputValues.length - 1; i >= 0; i--) {
      if (outputValues[i][0] !== "") {
        lastRowOutput = i + 1;
        break;
      }
    }

    // ---- 対象最終行は従来通り getLastRow（挙動不変） ----
    const lastRowTarget = sheet.getLastRow();

    // ---- 処理対象の行範囲を決定 ----
    const startRow = lastRowOutput + 1;
    let endRow = lastRowTarget;

    if (startRow > endRow) {
      console.log("処理対象のURLがありません");
      return;
    }

    // MAX_COUNT による上限制御（挙動不変）
    const total = endRow - startRow + 1;
    if (maxCount && total > maxCount) {
      endRow = startRow + maxCount - 1;
      console.log(`MAX_COUNT制限により処理行数を${maxCount}行に制限します`);
    }

    console.log(
      `処理対象行: ${startRow}行目から${endRow}行目まで（${endRow - startRow + 1}行）`,
    );
    console.log(`バッチサイズ設定: ${batchSize}`);

    // ---- 対象列のURLを一括取得 ----
    const urlRange = sheet.getRange(
      startRow,
      targetColumn,
      endRow - startRow + 1,
      1,
    );
    const urls = urlRange.getValues();

    // ---- その場チャンク処理：slice → map → setValues ----
    let processedCount = 0;

    for (let offset = 0; offset < urls.length; offset += batchSize) {
      const chunk = urls.slice(offset, offset + batchSize);
      const chunkStartRow = startRow + offset;

      const results = chunk.map((urlRow, indexInChunk) => {
        const url = String(urlRow?.[0] ?? "");
        const currentRow = chunkStartRow + indexInChunk;
        return processSingleUrl(url, currentRow, headerRow);
      });

      if (results.length > 0) {
        const outputRange = sheet.getRange(
          chunkStartRow,
          outputColumn,
          results.length,
          1,
        );
        outputRange.setValues(results);

        processedCount += results.length;
        console.log(
          `中間出力完了: ${chunkStartRow}行目から${results.length}行を出力列に出力（バッチサイズ: ${batchSize}）`,
        );
      }
    }

    console.log(`処理完了: ${processedCount}行の結果を出力列に出力しました`);

    // ---- MAX_COUNT 打ち切りの通知（挙動不変）----
    if (
      maxCount &&
      processedCount === maxCount &&
      startRow + maxCount - 1 < lastRowTarget
    ) {
      console.log(
        `注意: MAX_COUNT(${maxCount})制限により処理を制限しました。残り${lastRowTarget - (startRow + maxCount - 1)}行のデータが未処理です。`,
      );
    }
  } catch (error) {
    console.error("処理中にエラーが発生しました:", error);
    throw error;
  }
}
