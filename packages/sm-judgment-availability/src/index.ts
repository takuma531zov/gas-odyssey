const myFunction = () => {
  //1.スプレッドシートのデータ取得
  //指定した範囲のデータを取得し、各行ごとにDify APIにリクエストを送る。
  //2.Dify APIへのリクエスト
  //Difyを用いて各行のデータの整合性を判定し、結果を取得。
  //3.判定結果をスプレッドシートに書き込む
  //4.falseのデータを別シートに保存
  console.log("Hello");
};
declare let global: any;
global.main = myFunction;

const url = "http://16c7-153-194-40-105.ngrok-free.app/v1/workflows/run";
const apiKey = "{app-iO1ZuzLz0lRpgOb7d4HhpT7g}";

function runWorkflow() {
  var url = "http://16c7-153-194-40-105.ngrok-free.app/v1/workflows/run";
  var apiKey = "app-iO1ZuzLz0lRpgOb7d4HhpT7g"; // `{}` を削除

  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify({
      inputs: {},
      response_mode: "streaming",
      user: "abc-123",
    }),
    muteHttpExceptions: true, // エラーレスポンスを取得するために追加
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(response.getContentText());
    Logger.log("Response: " + JSON.stringify(data));
  } catch (error) {
    Logger.log("Error: " + error.message);
  }
}
declare let global: any;
global.main = runWorkflow;

runWorkflow();
