/*
スプレッドシート構成
sheet"FM" ファイルメーカーからエクスポートした情報。
sheet"DataBase" 小売り事業者正式名、FM入力フォーム入力パターンを蓄積

1.WithoutAIWorkFlow：sheet"FM"へcommonName が一致する offcialNameをsheet"DataBase" から取得。（commonNameが空白の行は処理しない）
2.AIWorkFlow:上記で一致する値が取得できなければdifyAPI連携にてデータを取得。取得した値をsheet"FM"出力、sheet"DataBase"へ蓄積
3.outputDefaultValue:commonNameが空白の行へ"地点番号"頭2桁から割り出した地域電力会社名を出力

→FMへインポート
*/
function myFunction(): void {
  console.log("Hello");
}
