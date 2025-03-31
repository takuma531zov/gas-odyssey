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

// Sheetの取得（スプレッドシートからシートを取得）
const sheet = getSheet("FM");
const lastRow = sheet.getLastRow(); // 最終行を取得（データがある行まで）
//スプレッドシートの H, J, M, O 列（8, 10, 13, 15列目）を、2行目以降すべて文字列に変換
function convertColumnsToText(): void {
  if (lastRow < 2) return; // データがなければ処理を終了

  const targetColumns = [8, 10, 13, 15]; // H, J, M, O 列の列番号

  targetColumns.forEach((col) => {
    const range = sheet.getRange(2, col, lastRow - 1, 1); // 2行目から最終行までの範囲
    const values: string[][] = range.getValues().map((row) => [String(row[0])]); // 文字列に変換
    range.setValues(values); // 元のデータを上書き
  });
}

/**
 * ID チェック処理
 */
function checkId(): string[][] {
  const data: string[][] = sheet.getRange(2, 2, lastRow - 1, 2).getValues(); // A列とB列のデータを取得

  const rules: { [key: string]: string } = {
    通信端末: "TID",
    機器家電: "TID",
    住設通信: "SGM",
  };

  const resultsD = data.map(([id, plan]) => {
    for (const [rulePlan, requiredId] of Object.entries(rules)) {
      if (plan.includes(rulePlan)) {
        return [id.includes(requiredId) ? "TRUE" : "FALSE"];
      }
    }
    return ["FALSE"]; // ルールに一致しない場合は false を返す
  });

  // D列に結果を書き込む（ヘッダー行を考慮し、2行目から）
  sheet.getRange(2, 4, resultsD.length, 1).setValues(resultsD);
  return resultsD;
}
/**
 * 住所や郵便番号のデータをフォーマットして変数に格納
 */
function formatTargetColumnsToVariables(): {
  nameFM: string[];
  nameDWH: string[];
  postCodeFM: string[];
  postCodeDWH: string[];
  adressFM: string[];
  adressDWH: string[];
} {
  const data: string[][] = sheet.getDataRange().getValues(); // シート全体のデータを取得
  const newdata = data.slice(1);
  // 各列のデータをフォーマットして変数に格納し、空文字を除外
  const nameFM = newdata.map((row) => {
    return formatName(row[4]); // E列
  });
  const nameDWH = newdata.map((row) => {
    return formatName(row[5]); // F列
  });
  const postCodeFM = newdata.map((row) => {
    return formatString(row[7]); // H列（8-1=7）
  });

  const postCodeDWH = newdata.map((row) => {
    return formatString(row[9]); // J列
  });

  const adressFM = newdata.map((row) => {
    return formatString(row[12]); // M列
  });

  const adressDWH = newdata.map((row) => {
    return formatString(row[14]); // O列s
  });

  // 結果をスプレッドシートに出力
  // それぞれの配列が空でない場合に書き込む
  if (postCodeFM.length > 0) {
    sheet
      .getRange(2, 9, postCodeFM.length, 1)
      .setValues(postCodeFM.map((value) => [value])); // I列
  }

  if (postCodeDWH.length > 0) {
    sheet
      .getRange(2, 11, postCodeDWH.length, 1)
      .setValues(postCodeDWH.map((value) => [value])); // K列
  }

  if (adressFM.length > 0) {
    sheet
      .getRange(2, 14, adressFM.length, 1)
      .setValues(adressFM.map((value) => [value])); // N列
  }

  if (adressDWH.length > 0) {
    sheet
      .getRange(2, 16, adressDWH.length, 1)
      .setValues(adressDWH.map((value) => [value])); // P列
  }

  return { nameFM, nameDWH, postCodeFM, postCodeDWH, adressFM, adressDWH };
}

/**
 * 全角を半角に変換する関数
 * @param str 変換対象の文字列
 * @returns 変換後の文字列
 */
function toHalfWidth(str: string): string {
  if (typeof str !== "string") {
    return ""; // 文字列以外の場合、空文字列を返す
  }
  return str.replace(/[！-～]/g, (match: string) => {
    return String.fromCharCode(match.charCodeAt(0) - 0xfee0);
  });
}

/**
 * 文字列をフォーマットする関数
 * @param str 変換対象の文字列
 * @returns 変換後の文字列
 */
function formatName(str: string): string {
  return str.replace(/\s+/g, ""); // 空白をすべて削除
}

function formatString(str: string): string {
  if (typeof str !== "string") {
    return str; // 文字列以外の場合、そのまま返す
  }

  // 全角を半角に変換
  let formatted = toHalfWidth(str);

  // 空白（全角・半角問わず）を削除
  formatted = formatted.replace(/\s+/g, "");

  // 数字以外を "*" に置換
  formatted = formatted.replace(/[^0-9]/g, "*");

  // 連続する "*" を 1つにまとめる
  formatted = formatted.replace(/\*+/g, "*");

  // 先頭・末尾の "*" を削除
  formatted = formatted.replace(/^\*+|\*+$/g, "");
  return formatted;
}
// フォーマット化されたデータを比較し結果をスプレッドシートへ出力
function compareAndWriteResults(formattedData: {
  nameFM: string[];
  nameDWH: string[];
  postCodeFM: string[];
  postCodeDWH: string[];
  adressFM: string[];
  adressDWH: string[];
}): void {
  const data: string[][] = sheet.getDataRange().getValues();
  const resultsD: string[][] = checkId();
  const resultsG: string[][] = [];
  const resultsL: string[][] = [];
  const resultsQ: string[][] = [];
  const resultsR: string[][] = [];
  const resultsS: string[][] = [];
  for (let i = 0; i <= data.length - 2; i++) {
    //G列
    resultsG.push([
      formattedData.nameFM[i] === formattedData.nameDWH[i] ? "TRUE" : "FALSE",
    ]);
    // L列（I列とK列の比較結果）
    resultsL.push([
      removeAsterisk(String(formattedData.postCodeFM[i])) ===
      removeAsterisk(String(formattedData.postCodeDWH[i]))
        ? "TRUE"
        : "FALSE",
    ]);

    // Q列（N列とP列の比較結果）
    resultsQ.push([
      formattedData.adressFM[i] === formattedData.adressDWH[i]
        ? "TRUE"
        : "FALSE",
    ]);
  }
  // G列に結果を書き込む
  sheet.getRange(2, 7, resultsG.length, 1).setValues(resultsG);
  // G列に結果を書き込む
  sheet.getRange(2, 7, resultsG.length, 1).setValues(resultsG);
  // L列（12番目）に結果を書き込む
  sheet.getRange(2, 12, resultsL.length, 1).setValues(resultsL);

  // Q列（17番目）に結果を書き込む
  sheet.getRange(2, 17, resultsQ.length, 1).setValues(resultsQ);
  // R列（最終結果）
  for (let i = 0; i < data.length - 1; i++) {
    const allResults = [
      resultsD[i][0], // checkIdの結果
      resultsG[i][0], // nameFM と nameDWH の比較
      resultsL[i][0], // postCodeFM と postCodeDWH の比較
      resultsQ[i][0], // adressFM と adressDWH の比較
    ];

    // 1つでも "FALSE" があれば "ERROR" を出力、それ以外は "OK"
    const finalResult = allResults.includes("FALSE") ? "ERROR" : "OK";

    // 結果を R列に格納
    resultsR.push([finalResult]);
    // "ERROR" の場合、"FALSE" が発生した項目を記録
    if (finalResult === "ERROR") {
      const falseItems: string[] = [];
      if (resultsD[i][0] === "FALSE") falseItems.push("D列");
      if (resultsG[i][0] === "FALSE") falseItems.push("G列");
      if (resultsL[i][0] === "FALSE") falseItems.push("L列");
      if (resultsQ[i][0] === "FALSE") falseItems.push("Q列");
      // S列に "FALSE" を発生させた項目を格納
      resultsS.push([falseItems.join(", ")]);
    } else {
      resultsS.push([""]); // "OK" の場合、S列は空にする
    }
  }

  // R列（18番目）に結果を書き込む
  sheet.getRange(2, 18, resultsR.length, 1).setValues(resultsR);

  // S列（19番目）に "FALSE" の項目を出力
  sheet.getRange(2, 19, resultsS.length, 1).setValues(resultsS);
}

/**
 * "*" を取り除く関数
 * @param str 文字列
 * @returns "*"を取り除いた文字列
 */
function removeAsterisk(str: string): string {
  return str.replace(/\*/g, ""); // "*" を削除
}
/**
 * メイン関数
 * 全ての処理をまとめて実行
 */

function main(): void {
  //数字→文字
  convertColumnsToText();
  // ID チェック処理
  checkId();

  // 住所や郵便番号のフォーマット処理
  const formattedData = formatTargetColumnsToVariables();

  // 結果を Logger に出力（デバッグ用）
  Logger.log(formattedData);

  compareAndWriteResults(formattedData);
}
