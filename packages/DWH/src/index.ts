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
const sheet = getSheet("FM");

function checkId() {
  // A列（1列目）とB列（2列目）のデータを取得
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
  // 対応ルール
  const rules: { [key: string]: string } = {
    通信端末: "TID",
    機器家電: "TID",
    住設通信: "SGM",
  };
  const results = data.map(([id, plan]) => {
    // plan（プラン名）がルールに部分一致するか確認
    for (const [rulePlan, requiredId] of Object.entries(rules)) {
      // 部分一致でチェック
      if (plan.includes(rulePlan)) {
        return [[id.includes(requiredId)]]; // 2次元配列として返す
      }
    }
    return [[false]]; // ルールに一致しない場合は false (2次元配列)
  });
  // D列に結果を書き込む（ヘッダー行を考慮し、2行目から）

  sheet.getRange(2, 4, results.length, 1).setValues(results);
}
