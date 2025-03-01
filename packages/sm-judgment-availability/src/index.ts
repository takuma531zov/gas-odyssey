export function myFunction() {
  //1.スプレッドシートのデータ取得
  //指定した範囲のデータを取得し、各行ごとにDify APIにリクエストを送る。
  //2.Dify APIへのリクエスト
  //Difyを用いて各行のデータの整合性を判定し、結果を取得。
  //3.判定結果をスプレッドシートに書き込む
  //4.falseのデータを別シートに保存
  console.log("Hello");
}
async function runWorkflow() {
  const url = "http://16c7-153-194-40-105.ngrok-free.app/v1/workflows/run";
  const apiKey = "app-iO1ZuzLz0lRpgOb7d4HhpT7g"; // 実際のAPIキーに置き換えてください

  const requestBody = {
    inputs: {}, // 必要な入力データを指定
    response_mode: "streaming", // 必要に応じて "blocking" に変更
    user: "abc-123",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Response:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// 実行
runWorkflow();
