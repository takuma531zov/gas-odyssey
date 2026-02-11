//通信端末と機器家電は"TID"、住設通信は"SGM"  ture →次の関数２へ　false →　別スプレッドシートへ
//2. シート"FM"とシート"DWH"の下記必要箇所のフォーマットの統一化
// シート"DWH"　都道府県名	市区町村名	町域名	住所番地以下　を結合→結合住所へ出力
// "送付先宛名""お客様コード" 空白を＊
// "送付先郵便番号"郵便番号" ハイフン空白を＊
// "送付先住所""結合住所"　ハイフン、空白、丁目、丁、番地、番、号を＊
//3.send data の準備
//4.dify に連携
// 項目ごとに意味的同一性を確認　項目全てが意味的に同一であればture　false →　別スプレッドシートへ

//1. シート"FM"のA列"サポートID"がB列"契約プラン"に対して妥当な値になっているか確認

import { getSheet } from "../../common/src/spreadsheet";

// Define constants for sheet names
const CHECK_DATA_SHEET_NAME = "CheckData";
const ERROR_LIST_SHEET_NAME = "ErrorList";

// Define constants for column indices (1-based for getRange)
// FM Sheet
const COL_FM_SUPPORT_ID = 1; // A
const COL_FM_CONTRACT_PLAN = 2; // B
// Column C is not used for ID check directly, but result is written to D (index 4)
const COL_FM_NAME = 4; // D
const COL_FM_POST_CODE = 5; // E
const COL_FM_ADDRESS = 6; // F
// DWH Sheet (assuming these are relative to the CheckData sheet's layout for comparison)
const COL_DWH_NAME = 7; // G
const COL_DWH_POST_CODE = 8; // H (Original comment: H, J, M, O) -> This is for formatting, not direct comparison logic yet
const COL_DWH_ADDRESS = 9; // I

// Columns for writing results/errors (on CheckData sheet)
const COL_ID_CHECK_RESULT = 4; // D (Original: checkId writes here, but it's not used later)
const COL_NAME_COMPARISON_RESULT = 7; // G (Original: name comparison result) - This seems off, G is COL_DWH_NAME
const COL_FINAL_RESULT = 10; // J (Original: R列 in comment, but code uses 10)
const COL_ERROR_ITEM_DETAILS = 11; // K (Original: K列 in comment, code uses 11)

// Columns for convertColumnsToText (originally H, J, M, O -> 8, 10, 13, 15)
const CONVERT_TO_TEXT_COLUMNS = [8, 10, 13, 15];


// Sheetの取得（スプレッドシートからシートを取得）
// Get sheet (get sheet from spreadsheet)
const sheet = getSheet(CHECK_DATA_SHEET_NAME);
const errorSheet = getSheet(ERROR_LIST_SHEET_NAME);
const lastRow = sheet.getLastRow(); // 最終行を取得（データがある行まで） // Get the last row (up to the row with data)

//スプレッドシートの H, J, M, O 列（8, 10, 13, 15列目）を、2行目以降すべて文字列に変換
// Convert columns H, J, M, O (8, 10, 13, 15) of the spreadsheet to text from the second row onwards.
function convertColumnsToText(): void {
  if (lastRow < 2) return; // データがなければ処理を終了 // If there is no data, terminate the process.

  // const targetColumns = [8, 10, 13, 15]; // H, J, M, O 列の列番号 // Column numbers for H, J, M, O

  CONVERT_TO_TEXT_COLUMNS.forEach((col) => {
    const range = sheet.getRange(2, col, lastRow - 1, 1); // 2行目から最終行までの範囲 // Range from the 2nd row to the last row
    const values: string[][] = range.getValues().map((row) => [String(row[0])]); // 文字列に変換
    range.setValues(values); // 元のデータを上書き
  });
}

/**
 * ID チェック処理
 * ID Check Process
 */
function checkId(): string[][] {
  // Get data from columns B (Contract Plan) and A (Support ID)
  // Note: getRange uses 1-based indexing.
  // However, the original code sheet.getRange(2, 2, lastRow - 1, 2) implies it was getting B and C,
  // or if it means (startRow, startCol, numRows, numCols), it was getting COL_FM_CONTRACT_PLAN and the column next to it.
  // Assuming it's Support ID (A) and Contract Plan (B) as per comment "シート"FM"のA列"サポートID"がB列"契約プラン"に対して妥当な値になっているか確認"
  const data: string[][] = sheet.getRange(2, COL_FM_SUPPORT_ID, lastRow - 1, 2).getValues(); // Get data from COL_FM_SUPPORT_ID and COL_FM_CONTRACT_PLAN

  // Define rules for ID validation based on contract plan.
  // Key: Part of the contract plan name. Value: Expected characters in the Support ID.
  const rules: { [key: string]: string } = {
    通信端末: "TID", // Communication Terminal
    機器家電: "TID", // Equipment Home Appliances
    住設通信: "SGM", // Housing Equipment Communication
  };

  // Validate each row based on the rules.
  const idCheckResults = data.map(([id, plan]) => { // Renamed resultsD to idCheckResults
    // Iterate through each rule.
    for (const [rulePlan, requiredId] of Object.entries(rules)) {
      // If the plan in the data includes the plan string from the rule...
      if (plan.includes(rulePlan)) {
        // ...then check if the ID includes the required ID string.
        return [id.includes(requiredId) ? "TRUE" : "FALSE"];
      }
    }
    // If no rule matches the plan, return "FALSE".
    return ["FALSE"]; // ルールに一致しない場合は false を返す (If no rule matches, return false)
  });

  // // D列に結果を書き込む（ヘッダー行を考慮し、2行目から）
  // // Write results to column D (considering header row, starting from 2nd row)
  // sheet.getRange(2, COL_ID_CHECK_RESULT, idCheckResults.length, 1).setValues(idCheckResults);
  return idCheckResults;
}
/**
 * 住所や郵便番号のデータをフォーマットして変数に格納
 * Formats address and postal code data and stores them in variables.
 */
function formatTargetColumnsToVariables(): {
  nameFM: string[];
  nameDWH: string[];
  postCodeFM: string[];
  postCodeDWH: string[];
  addressFM: string[]; // Corrected typo from adressFM
  addressDWH: string[]; // Corrected typo from adressDWH
} {
  const allSheetData: string[][] = sheet.getDataRange().getValues(); // シート全体のデータを取得 // Get all data from the sheet
  const dataRows = allSheetData.slice(1); // Remove header row, renamed newdata to dataRows
  // 各列のデータをフォーマットして変数に格納し、空文字を除外
  // Format data for each column, store in variables, and exclude empty strings (though current formatters handle non-strings)

  // Array indices are 0-based. Column constants are 1-based.
  const nameFM = dataRows.map((row) => {
    return formatName(row[COL_FM_NAME - 1]); // D列 -> index 3
  });
  const nameDWH = dataRows.map((row) => {
    return formatName(row[COL_DWH_NAME - 1]); // G列 -> index 6
  });
  const postCodeFM = dataRows.map((row) => {
    return formatString(row[COL_FM_POST_CODE - 1]); // E列 -> index 4
  });

  const postCodeDWH = dataRows.map((row) => {
    // H列 -> index 7, which is one of the CONVERT_TO_TEXT_COLUMNS
    return formatString(row[COL_DWH_POST_CODE - 1]);
  });

  const addressFM = dataRows.map((row) => { // Corrected typo from adressFM
    return formatString(row[COL_FM_ADDRESS - 1]); // F列 -> index 5
  });

  const addressDWH = dataRows.map((row) => { // Corrected typo from adressDWH
    // I列 -> index 8. Original comment mentions M and O (13, 15) for formatting,
    // but comparison logic uses I. Assuming COL_DWH_ADDRESS (I) is correct for data.
    return formatString(row[COL_DWH_ADDRESS - 1]);
  });

  return { nameFM, nameDWH, postCodeFM, postCodeDWH, addressFM, addressDWH };
}

/**
 * 全角を半角に変換する関数
 * Converts full-width characters to half-width.
 * @param str 変換対象の文字列 The string to be converted.
 * @returns 変換後の文字列 The converted string.
 */
function toHalfWidth(str: string): string {
  if (typeof str !== "string") {
    return ""; // 文字列以外の場合、空文字列を返す // If not a string, return an empty string.
  }
  // Replace full-width Zenkaku characters (Unicode range FF01-FF5E)
  // with their half-width Hankaku equivalents.
  return str.replace(/[！-～]/g, (match: string) => {
    return String.fromCharCode(match.charCodeAt(0) - 0xfee0);
  });
}

/**
 * 文字列をフォーマットする関数 (名前用)
 * Formats a string (specifically for names).
 * @param str 変換対象の文字列 The string to be converted.
 * @returns 変換後の文字列 The converted string.
 */
function formatName(str: string): string {
  if (typeof str !== "string") {
    return ""; // Return empty string if not a string, to avoid errors with .replace
  }
  return str.replace(/\s+/g, ""); // 空白をすべて削除 // Remove all whitespace.
}

/**
 * Formats a string by converting to half-width, removing whitespace,
 * replacing non-numeric characters with '*', consolidating multiple asterisks,
 * and removing leading/trailing asterisks.
 * @param str The string to be formatted.
 * @returns The formatted string.
 */
function formatString(str: string): string {
  if (typeof str !== "string") {
    return str; // 文字列以外の場合、そのまま返す // If not a string, return as is.
  }

  // Step 1: Convert full-width characters to half-width.
  // Example: "１２３ＡＢＣ" -> "123ABC"
  let formatted = toHalfWidth(str);

  // Step 2: Remove all whitespace (both full-width and half-width).
  // Example: "123 ABC" -> "123ABC"
  formatted = formatted.replace(/\s+/g, "");

  // Step 3: Replace all non-numeric characters with a single asterisk.
  // Example: "123ABC-DEF" -> "123***-***" (intermediate, then further processed by next step)
  // More accurately: "123ABC-DEF" -> "123*****" (after this step)
  formatted = formatted.replace(/[^0-9]/g, "*");

  // Step 4: Consolidate multiple consecutive asterisks into a single asterisk.
  // Example: "123*****" -> "123*"
  formatted = formatted.replace(/\*+/g, "*");

  // Step 5: Remove leading and trailing asterisks.
  // Example: "*123*" -> "123", or "ABC*" -> "ABC" (if it was like that before num replace)
  // Example after previous steps: "123*" -> "123" or "*123" -> "123"
  formatted = formatted.replace(/^\*+|\*+$/g, "");
  return formatted;
}

// フォーマット化されたデータを比較し結果をスプレッドシートへ出力
// Compares formatted data and writes the results to the spreadsheet.
function compareAndWriteResults(
  idCheckResults: string[][], // Parameter added
  formattedData: {
    nameFM: string[];
    nameDWH: string[];
    postCodeFM: string[];
    postCodeDWH: string[];
    addressFM: string[];
    addressDWH: string[];
  }
): string[][] {
  const sheetData: string[][] = sheet.getDataRange().getValues(); // Renamed data to sheetData
  // const idResults: string[][] = checkId(); // Renamed resultID, now passed as parameter

  const nameComparisonResults: string[][] = [];
  const postCodeComparisonResults: string[][] = [];
  const addressComparisonResults: string[][] = [];
  const finalResults: string[][] = [];
  const errorItemDetails: string[][] = [];
  const errorRows: string[][] = [];

  // Helper function for simple direct string comparison
  function compareDirectly(item1: string, item2: string): string {
    return item1 === item2 ? "TRUE" : "FALSE";
  }

  // Helper function for comparing postal codes after removing asterisks
  function comparePostCodes(postCode1: string, postCode2: string): string {
    return removeAsterisk(postCode1) === removeAsterisk(postCode2) ? "TRUE" : "FALSE";
  }


  for (let i = 0; i < formattedData.nameFM.length; i++) {
    nameComparisonResults.push([compareDirectly(formattedData.nameFM[i], formattedData.nameDWH[i])]);
    postCodeComparisonResults.push([comparePostCodes(String(formattedData.postCodeFM[i]), String(formattedData.postCodeDWH[i]))]);
    addressComparisonResults.push([compareDirectly(formattedData.addressFM[i], formattedData.addressDWH[i])]);
  }

  // Determine final result and error details for each row
  for (let i = 0; i < formattedData.nameFM.length; i++) {
    const idResult = idCheckResults[i][0];
    const nameResult = nameComparisonResults[i][0];
    const postCodeResult = postCodeComparisonResults[i][0];
    const addressResult = addressComparisonResults[i][0];

    const allComparisonChecks = [
      idResult,
      nameResult,
      postCodeResult,
      addressResult,
    ];

    // If any of the checks are "FALSE", the final result for the row is "ERROR". Otherwise, it's "OK".
    // This check explicitly looks for "FALSE" to determine if there's an error.
    const singleRowFinalResult = allComparisonChecks.includes("FALSE") ? "ERROR" : "OK";

    finalResults.push([singleRowFinalResult]);

    // If the result is "ERROR", record which items caused the error.
    if (singleRowFinalResult === "ERROR") {
      const falseItems: string[] = [];
      if (idResult === "FALSE") falseItems.push("ID");
      if (nameResult === "FALSE") falseItems.push("Name");
      if (postCodeResult === "FALSE") falseItems.push("Postal Code");
      if (addressResult === "FALSE") falseItems.push("Address");
      
      errorItemDetails.push([falseItems.join(", ")]);

      // If "ERROR", add the original data row (from the second row of sheetData, hence i + 1) to errorRows for writing to ErrorList sheet.
      // sheetData[0] is the header row. Data rows start from sheetData[1].
      // The loop index `i` corresponds to `formattedData.nameFM[i]`, which is based on dataRows (sheetData.slice(1)).
      // So, the original row in sheetData is sheetData[i + 1].
      errorRows.push(sheetData[i + 1]);
    } else {
      // If "OK", add an empty string for error details.
      errorItemDetails.push([""]);
    }
  }

  // Write the final overall results to the sheet (e.g., "OK" or "ERROR")
  // Starting from the second row, in the column specified by COL_FINAL_RESULT
  sheet.getRange(2, COL_FINAL_RESULT, finalResults.length, 1).setValues(finalResults);

  // Write the details of items that caused an "ERROR"
  // Starting from the second row, in the column specified by COL_ERROR_ITEM_DETAILS
  sheet.getRange(2, COL_ERROR_ITEM_DETAILS, errorItemDetails.length, 1).setValues(errorItemDetails);
  
  return errorRows; // Return rows that had errors
}
/**
 * "*" を取り除く関数
 * Removes all asterisks from a string.
 * @param str 文字列 The input string.
 * @returns "*"を取り除いた文字列 String with asterisks removed.
 */
function removeAsterisk(str: string): string {
  if (typeof str !== "string") return ""; // Handle non-string input
  return str.replace(/\*/g, ""); // "*" を削除 // Remove all occurrences of "*".
}
/**
 * メイン関数
 * Main function to execute all processing steps.
 * 全ての処理をまとめて実行
 */

// Function to write error rows to the ErrorList sheet
function writeErrorRowsToSheet(errorRows: string[][]): void {
  if (errorRows.length === 0) return; // エラー行がない場合は処理を終了 // If there are no error rows, terminate the process.

  const startRow = 2; // データは2行目から書き込む // Data will be written starting from the 2nd row.
  const startCol = 1; // A列（1列目）にそのまま出力 // Output directly to column A (1st column).

  // エラーシートの現在のデータ行を取得（ヘッダーを除く）
  // Get the current number of data rows in the error sheet (excluding header)
  const sheetLastRow = errorSheet.getLastRow();
  const lastDataRow = startRow + errorRows.length - 1;

  // データをA2から書き込む（ヘッダー行は保持）
  // Write data starting from A2 (keeping the header row).
  errorSheet
    .getRange(startRow, startCol, errorRows.length, errorRows[0].length)
    .setValues(errorRows);

  // 既存のデータが今回のデータより多い場合、余分な行を削除
  // If existing data has more rows than the current data, delete the excess rows.
  if (sheetLastRow > lastDataRow) {
    errorSheet.deleteRows(lastDataRow + 1, sheetLastRow - lastDataRow);
  }
}

function main(): void {
  //数字→文字
  // Convert specified columns to text format first.
  convertColumnsToText();

  // ID チェック処理
  // Perform ID check.
  const idCheckResults = checkId(); // Store the result

  // 住所や郵便番号のフォーマット処理
  // Format address and postal code data.
  const formattedData = formatTargetColumnsToVariables();

  // 結果を Logger に出力（デバッグ用）
  // Output results to Logger (for debugging).
  // Logger.log(formattedData); // Commented out for now, can be enabled for debugging

  // Compare formatted data, including ID check results, and write to sheet.
  // Pass idCheckResults to compareAndWriteResults.
  const errorRows = compareAndWriteResults(idCheckResults, formattedData); // Removed redundant call

  // Write rows with errors to the dedicated error sheet.
  writeErrorRowsToSheet(errorRows);
}
