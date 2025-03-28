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

/**
 * ID チェック処理
 */
function checkId(): void {
  const lastRow = sheet.getLastRow();
  const data: string[][] = sheet.getRange(2, 2, lastRow - 1, 2).getValues(); // A列とB列のデータを取得

  const rules: { [key: string]: string } = {
    通信端末: "TID",
    機器家電: "TID",
    住設通信: "SGM",
  };

  const results = data.map(([id, plan]) => {
    for (const [rulePlan, requiredId] of Object.entries(rules)) {
      if (plan.includes(rulePlan)) {
        return [[id.includes(requiredId)]]; // 2次元配列として返す
      }
    }
    return [[false]]; // ルールに一致しない場合は false を返す
  });

  // D列に結果を書き込む（ヘッダー行を考慮し、2行目から）
  sheet.getRange(2, 4, results.length, 1).setValues(results);
}

/**
 * 住所や郵便番号のデータをフォーマットして変数に格納
 */
function formatTargetColumnsToVariables(): {
  postCodeFM: string[];
  postCodeDWH: string[];
  adressFM: string[];
  adressDWH: string[];
} {
  const data: string[][] = sheet.getDataRange().getValues(); // シート全体のデータを取得

  // 各列のデータをフォーマットして変数に格納し、空文字を除外
  const postCodeFM = data
    .map((row) => {
      const formatted = formatString(row[7] ?? ""); // H列（8-1=7）
      return formatted !== row[7] ? formatted : row[7];
    })
    .filter((val) => val !== ""); // 空文字を除外

  const postCodeDWH = data
    .map((row) => {
      const formatted = formatString(row[9] ?? ""); // J列
      return formatted !== row[9] ? formatted : row[9];
    })
    .filter((val) => val !== ""); // 空文字を除外

  const adressFM = data
    .map((row) => {
      const formatted = formatString(row[12] ?? ""); // M列
      return formatted !== row[12] ? formatted : row[12];
    })
    .filter((val) => val !== ""); // 空文字を除外

  const adressDWH = data
    .map((row) => {
      const formatted = formatString(row[14] ?? ""); // O列
      return formatted !== row[14] ? formatted : row[14];
    })
    .filter((val) => val !== ""); // 空文字を除外

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

  return { postCodeFM, postCodeDWH, adressFM, adressDWH };
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
  return str
    .replace(/[！-～]/g, (match: string) => {
      return String.fromCharCode(match.charCodeAt(0) - 0xfee0);
    })
    .replace(/　/g, " "); // 全角スペースを半角スペースに変換
}

/**
 * 文字列をフォーマットする関数
 * @param str 変換対象の文字列
 * @returns 変換後の文字列
 */
function formatString(str: string): string {
  if (typeof str !== "string") {
    return str; // 文字列以外の場合、そのまま返す
  }

  // 全角を半角に変換
  let formatted = toHalfWidth(str);

  // 数字以外を "*" に置換
  formatted = formatted.replace(/[^0-9]/g, "*");

  // 連続する "*" を 1つにまとめる
  formatted = formatted.replace(/\*+/g, "*");

  // 先頭・末尾の "*" を削除
  formatted = formatted.replace(/^\*+|\*+$/g, "");

  return formatted;
}
// フォーマット化されたデータを比較し結果をスプレッドシートへ出力s
function compareColumnsAndWriteResults(): void {
  const sheet = getSheet("FM"); // 対象のシートを取得
  const data: string[][] = sheet.getDataRange().getValues(); // シート全体のデータを取得

  // 結果を格納する配列
  const results = data.map((row) => {
    const compareIK = row[8] === row[10] ? "TRUE" : "FALSE"; // I列(9-1) と K列(11-1) を比較
    const compareNP = row[13] === row[15] ? "TRUE" : "FALSE"; // N列(14-1) と P列(16-1) を比較
    return [compareIK, compareNP];
  });

  // L列（12番目）と Q列（17番目）に結果を書き込む
  sheet.getRange(2, 12, results.length, 2).setValues(results);
}
/**
 * メイン関数
 * 全ての処理をまとめて実行
 */
function main(): void {
  // ID チェック処理
  checkId();

  // 住所や郵便番号のフォーマット処理
  const formattedData = formatTargetColumnsToVariables();

  // 結果を Logger に出力（デバッグ用）
  Logger.log(formattedData);

  compareColumnsAndWriteResults();
}

// メイン関数を実行
main();
