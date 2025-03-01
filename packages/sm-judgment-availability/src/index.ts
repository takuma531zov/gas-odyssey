export function myFunction() {
  //1.スプレッドシートのデータ取得
  //指定した範囲のデータを取得し、各行ごとにDify APIにリクエストを送る。
  //2.Dify APIへのリクエスト
  //Difyを用いて各行のデータの整合性を判定し、結果を取得。
  //3.判定結果をスプレッドシートに書き込む
  //4.falseのデータを別シートに保存
  console.log("Hello");
}
export function runWorkflow() {
  var url = "http://16c7-153-194-40-105.ngrok-free.app/v1/workflows/run";
  var apiKey = "app-iO1ZuzLz0lRpgOb7d4HhpT7g"; // 実際のAPIキーに置き換えてください

  var requestData = {
    inputs: {}, // 必要に応じて入力データを指定
    response_mode: "streaming", // "blocking" に変更可能
    user: "abc-123",
  };

  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(requestData),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var jsonResponse = response.getContentText();
    Logger.log("Response: " + jsonResponse);
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}
