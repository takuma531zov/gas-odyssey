// const myFunction = () => {
//   //1.スプレッドシートのデータ取得
//   //指定した範囲のデータを取得し、各行ごとにDify APIにリクエストを送る。
//   //2.Dify APIへのリクエスト
//   //Difyを用いて各行のデータの整合性を判定し、結果を取得。
//   //3.判定結果をスプレッドシートに書き込む
//   //4.falseのデータを別シートに保存
//   console.log("Hello");
// };
// declare let global: any;
// global.main = myFunction;
// //API連携確認
// function runWorkflow() {
//   var url = "https://ec47-103-5-140-129.ngrok-free.app/v1/workflows/run";
//   var apiKey = PropertiesService.getScriptProperties().getProperty("API_KEY");

//   var requestBody = {
//     inputs: {
//       input: "りんご",
//     },
//     response_mode: "blocking", // streaming ではなく blocking を推奨
//     user: "abc-123",
//   };

//   var options = {
//     method: "post",
//     headers: {
//       Authorization: "Bearer " + apiKey,
//       "Content-Type": "application/json",
//     },
//     payload: JSON.stringify(requestBody),
//     muteHttpExceptions: true, // エラー時にレスポンスを取得する
//   };

//   try {
//     var response = UrlFetchApp.fetch(url, options);
//     var data = JSON.parse(response.getContentText());
//     Logger.log("Response: " + JSON.stringify(data));
//   } catch (error) {
//     Logger.log("Error: " + error.message);
//   }
// }
declare let global: any;
global.main = runWorkflow;

runWorkflow();

//スプシ情報取得
function getSpreadsheetData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート1");
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  if (data.length === 0 || data[0].every((cell) => cell === "")) {
    Logger.log("データがありません");
    return null;
  }
  var records = data
    .map((row) => row.filter((cell) => cell !== "").join(" "))
    .filter((phrase) => phrase !== "");
  Logger.log("取得データ: " + JSON.stringify(records));
  return records.length > 0 ? records : null;
}

function prepareRequestData(record) {
  if (!record || record.length === 0) {
    Logger.log("入力データがありません");
    return null;
  }
  return {
    inputs: { text: JSON.stringify([record]) },
    // **リストとして送信**
    response_mode: "blocking",
    user: "abc-123",
  };
}

function sendDataToDify(requestBody, rowIndex) {
  if (!requestBody) {
    Logger.log("リクエストデータが不正です");
    return;
  }
  Logger.log("送信データ: " + JSON.stringify(requestBody));
  var url = "https://ec47-103-5-140-129.ngrok-free.app/v1/workflows/run";
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
    writeResultsToSpreadsheet(rowIndex, responseData);
  } catch (error) {
    Logger.log("Error: " + error.message);
  }
}

function writeResultsToSpreadsheet(rowIndex, responseData) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート1");
  if (responseData.data && responseData.data.outputs.text) {
    var resultText = responseData.data.outputs.text.trim();
    sheet.getRange(rowIndex + 2, 5).setValue(resultText); // rowIndexを使用
    Logger.log("結果を書き込みました: " + resultText);
  } else {
    Logger.log("エラー: Difyのレスポンスが不正です");
  }
}

function runWorkflow() {
  var records = getSpreadsheetData();
  if (!records) {
    Logger.log("データ取得に失敗しました");
    return;
  }

  // 各行ごとに処理を行う
  for (var i = 0; i < records.length; i++) {
    var record = records[i].split(" "); // 行ごとに空白で分割して送信
    var requestBody = prepareRequestData(record);
    if (!requestBody) {
      Logger.log("リクエストデータの作成に失敗しました");
      continue;
    }
    sendDataToDify(requestBody, i); // 行番号iを渡す
  }
}
