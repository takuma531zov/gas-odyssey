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
  var url = "http://d1dc-60-87-94-224.ngrok-free.app/v1/workflows/run";
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

  if (data.length === 0 || data[0].every((cell) => cell === "")) {
    Logger.log("データがありません");
    return null;
  }

  // 各行のセルを結合し、フレーズリストに変換
  var records = data
    .map((row) => row.filter((cell) => cell !== "").join(" ")) // 空セルを除外し結合
    .filter((phrase) => phrase !== ""); // 空のフレーズを削除

  Logger.log("取得データ: " + JSON.stringify(records)); // **取得データをログ出力**
  return records.length > 0 ? records : null;
}

function prepareRequestData(recordArray) {
  if (!recordArray || recordArray.length === 0) {
    Logger.log("入力データがありません");
    return null;
  }

  return {
    inputs: { text: recordArray }, // **リストとして送信**
    response_mode: "blocking",
    user: "abc-123",
  };
}

function sendDataToDify(requestBody) {
  if (!requestBody) {
    Logger.log("リクエストデータが不正です");
    return;
  }

  Logger.log("送信データ: " + JSON.stringify(requestBody)); // **送信データをログ出力**

  var url = "http://d1dc-60-87-94-224.ngrok-free.app/v1/workflows/run";
  var apiKey =
    PropertiesService.getScriptProperties().getProperty("CHECK_API_KEY");

  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    Logger.log("Raw Response: " + responseText);

    var responseData = JSON.parse(responseText);
    Logger.log("Parsed JSON: " + JSON.stringify(responseData));
  } catch (error) {
    Logger.log("Error: " + error.message);
  }
}

function runWorkflow() {
  var recordArray = getSpreadsheetData();
  var requestBody = prepareRequestData(recordArray);
  sendDataToDify(requestBody);
}
