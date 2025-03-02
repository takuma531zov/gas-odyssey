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
//API連携確認
function runWorkflow() {
  var url = "http://16c7-153-194-40-105.ngrok-free.app/v1/workflows/run";
  var apiKey = PropertiesService.getScriptProperties().getProperty("API_KEY");

  var requestBody = {
    inputs: {
      input: "りんご",
    },
    response_mode: "blocking", // streaming ではなく blocking を推奨
    user: "abc-123",
  };

  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true, // エラー時にレスポンスを取得する
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
//スプシ情報取得
function getSpreadsheetData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート1"); // シート名を指定
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues(); // A～E列を取得

  var headers = ["名称１", "名称２", "名称3", "名称4", "名称5"]; // 列名の仮のヘッダー

  var records = data.map((row) => {
    var record = {};
    headers.forEach((key, index) => {
      record[key] = row[index];
    });
    return record;
  });

  return records;
}

function prepareRequestData(records) {
  return {
    inputs: { records: records },
    response_mode: "blocking",
    user: "abc-123",
  };
}
