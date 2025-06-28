import * as env from "./env";

const API_KEY = env.CLOUD_VISION_API_KEY;
const FREECONVERT_API_KEY = env.FREE_CONVERT_API_KEY;
const FREECONVERT_BASE_URL = "https://api.freeconvert.com/v1";

/**
 * HEIC形式判定
 */
function isHEICFile(file: GoogleAppsScript.Drive.File): boolean {
  const fileName = file.getName().toLowerCase();
  const contentType = file.getBlob().getContentType();

  return (
    fileName.endsWith(".heic") ||
    fileName.endsWith(".heif") ||
    contentType === "image/heic" ||
    contentType === "image/heif" ||
    /^img_\d{4}\.(heic|jpg)$/i.test(fileName)
  );
}

/**
 * FreeConvert API - ファイルインポート
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
async function createImportTask(): Promise<any> {
  const response = UrlFetchApp.fetch(
    `${FREECONVERT_BASE_URL}/process/import/upload`,
    {
      method: "post",
      headers: {
        Authorization: `Bearer ${FREECONVERT_API_KEY}`,
        Accept: "application/json",
      },
      muteHttpExceptions: true,
    },
  );

  if (
    response.getResponseCode() !== 200 &&
    response.getResponseCode() !== 201
  ) {
    throw new Error(
      `Import task creation failed: ${response.getContentText()}`,
    );
  }

  return JSON.parse(response.getContentText());
}

/**
 * FreeConvert API - ファイルアップロード
 */
async function uploadFile(
  file: GoogleAppsScript.Drive.File,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  importTask: any,
): Promise<void> {
  const formData = {
    ...importTask.result.form.parameters,
    file: file.getBlob(),
  };

  const response = UrlFetchApp.fetch(importTask.result.form.url, {
    method: "post",
    payload: formData,
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`File upload failed: ${response.getContentText()}`);
  }
}

/**
 * FreeConvert API - 変換タスク作成
 */
async function createConvertTask(importTaskId: string): Promise<string> {
  const response = UrlFetchApp.fetch(
    `${FREECONVERT_BASE_URL}/process/convert`,
    {
      method: "post",
      headers: {
        Authorization: `Bearer ${FREECONVERT_API_KEY}`,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        input: importTaskId,
        input_format: "heic",
        output_format: "jpg",
        options: { quality: 90 },
      }),
      muteHttpExceptions: true,
    },
  );

  if (
    response.getResponseCode() !== 200 &&
    response.getResponseCode() !== 201
  ) {
    throw new Error(
      `Convert task creation failed: ${response.getContentText()}`,
    );
  }

  const result = JSON.parse(response.getContentText());
  return result.id;
}

/**
 * FreeConvert API - タスクステータス確認
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
async function getTaskStatus(taskId: string): Promise<any> {
  const response = UrlFetchApp.fetch(
    `${FREECONVERT_BASE_URL}/process/tasks/${taskId}`,
    {
      headers: { Authorization: `Bearer ${FREECONVERT_API_KEY}` },
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() !== 200) {
    throw new Error("Status check failed");
  }

  return JSON.parse(response.getContentText());
}

/**
 * FreeConvert API - 変換完了待機
 */
async function waitForConversion(taskId: string): Promise<string> {
  const maxAttempts = 40;
  const sleepInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    Utilities.sleep(sleepInterval);

    const status = await getTaskStatus(taskId);

    if (status.status === "completed") {
      return status.result.url;
    }

    if (status.status === "failed" || status.status === "error") {
      throw new Error(`Conversion failed: ${JSON.stringify(status)}`);
    }
  }

  throw new Error("Conversion timeout");
}

/**
 * HEIC→JPEG変換（従来方式）
 */
async function convertHEICToJPEG(
  file: GoogleAppsScript.Drive.File,
): Promise<GoogleAppsScript.Base.Blob | null> {
  if (!FREECONVERT_API_KEY) {
    console.error("FREECONVERT_API_KEY is not configured");
    return null;
  }

  try {
    const importTask = await createImportTask();
    await uploadFile(file, importTask);
    const convertTaskId = await createConvertTask(importTask.id);
    const downloadUrl = await waitForConversion(convertTaskId);

    const downloadResponse = UrlFetchApp.fetch(downloadUrl);
    return downloadResponse
      .getBlob()
      .setName(file.getName().replace(/\.heic$/i, ".jpg"));
  } catch (error) {
    console.error("HEIC conversion failed:", error);
    return null;
  }
}

/**
 * Job API - ジョブ作成
 */

async function createConversionJob(
  file: GoogleAppsScript.Drive.File,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
): Promise<any> {
  const jobPayload = {
    tag: `heic-conversion-${Date.now()}`,
    tasks: {
      "import-task": {
        operation: "import/upload",
      },
      "convert-task": {
        operation: "convert",
        input: "import-task",
        input_format: "heic",
        output_format: "jpg",
        options: {
          quality: 90,
        },
      },
      "export-task": {
        operation: "export/url",
        input: "convert-task",
      },
    },
  };

  const response = UrlFetchApp.fetch(`${FREECONVERT_BASE_URL}/process/jobs`, {
    method: "post",
    headers: {
      Authorization: `Bearer ${FREECONVERT_API_KEY}`,
      "Content-Type": "application/json",
    },
    payload: JSON.stringify(jobPayload),
    muteHttpExceptions: true,
  });

  if (
    response.getResponseCode() !== 200 &&
    response.getResponseCode() !== 201
  ) {
    throw new Error(`Job creation failed: ${response.getContentText()}`);
  }

  return JSON.parse(response.getContentText());
}

/**
 * Job API - ジョブステータス確認
 */
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
async function getJobStatus(jobId: string): Promise<any> {
  const response = UrlFetchApp.fetch(
    `${FREECONVERT_BASE_URL}/process/jobs/${jobId}`,
    {
      headers: { Authorization: `Bearer ${FREECONVERT_API_KEY}` },
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() !== 200) {
    throw new Error("Job status check failed");
  }

  return JSON.parse(response.getContentText());
}

/**
 * Job API - ファイルアップロード
 */

async function uploadFileToJob(
  file: GoogleAppsScript.Drive.File,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  job: any,
): Promise<void> {
  // import-taskのアップロードURLを取得
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const importTask = job.tasks.find((task: any) => task.name === "import-task");

  if (!importTask || !importTask.result?.form) {
    throw new Error("Import task form data not found");
  }

  const formData = {
    ...importTask.result.form.parameters,
    file: file.getBlob(),
  };

  const response = UrlFetchApp.fetch(importTask.result.form.url, {
    method: "post",
    payload: formData,
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`File upload failed: ${response.getContentText()}`);
  }
}

/**
 * Job API - ジョブ完了待機
 */
async function waitForJobCompletion(jobId: string): Promise<string> {
  const maxAttempts = 40;
  const sleepInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    Utilities.sleep(sleepInterval);

    const job = await getJobStatus(jobId);

    if (job.status === "completed") {
      // export-taskの結果URLを取得

      const exportTask = job.tasks.find(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (task: any) => task.name === "export-task",
      );

      if (!exportTask?.result?.url) {
        throw new Error("Export task result URL not found");
      }

      return exportTask.result.url;
    }

    if (job.status === "failed" || job.status === "error") {
      throw new Error(`Job failed: ${JSON.stringify(job)}`);
    }
  }

  throw new Error("Job completion timeout");
}

/**
 * HEIC→JPEG変換（Job API版）
 */
async function convertHEICToJPEGWithJob(
  file: GoogleAppsScript.Drive.File,
): Promise<GoogleAppsScript.Base.Blob | null> {
  if (!FREECONVERT_API_KEY) {
    console.error("FREECONVERT_API_KEY is not configured");
    return null;
  }

  try {
    console.log(`Job API conversion started: ${file.getName()}`);

    // 1. ジョブ作成
    const job = await createConversionJob(file);
    console.log(`Job created: ${job.id}`);

    // 2. ファイルアップロード
    await uploadFileToJob(file, job);
    console.log("File uploaded successfully");

    // 3. ジョブ完了待機
    const downloadUrl = await waitForJobCompletion(job.id);

    // 4. 変換済みファイルダウンロード
    const downloadResponse = UrlFetchApp.fetch(downloadUrl);
    console.log("Job API conversion completed");

    return downloadResponse
      .getBlob()
      .setName(file.getName().replace(/\.heic$/i, ".jpg"));
  } catch (error) {
    console.error("Job API conversion failed:", error);
    return null;
  }
}

/**
 * Google Vision API - OCR実行
 */
async function performOCR(blob: GoogleAppsScript.Base.Blob): Promise<string> {
  const base64Image = Utilities.base64Encode(blob.getBytes());
  const payload = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: "TEXT_DETECTION" },
          { type: "DOCUMENT_TEXT_DETECTION" },
        ],
        imageContext: { languageHints: ["ja", "en"] },
      },
    ],
  };

  const response = UrlFetchApp.fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() !== 200) {
    throw new Error(`OCR API error: ${response.getContentText()}`);
  }

  const result = JSON.parse(response.getContentText());
  return result.responses?.[0]?.fullTextAnnotation?.text || "";
}

/**
 * メインOCR関数
 */
export async function runOcr(
  file: GoogleAppsScript.Drive.File,
  debug = false,
): Promise<string> {
  try {
    let processingBlob: GoogleAppsScript.Base.Blob;

    if (isHEICFile(file)) {
      if (debug) console.log(`Converting HEIC file: ${file.getName()}`);

      // Job API を優先して使用、失敗時は従来方式にフォールバック
      let convertedBlob = await convertHEICToJPEGWithJob(file);
      if (!convertedBlob) {
        if (debug) console.log("Job API failed, trying traditional method");
        convertedBlob = await convertHEICToJPEG(file);
      }

      if (convertedBlob) {
        processingBlob = convertedBlob;
      } else {
        if (debug) console.log("HEIC conversion failed, trying direct OCR");
        processingBlob = file.getBlob();
      }
    } else {
      processingBlob = file.getBlob();
    }

    const text = await performOCR(processingBlob);

    if (debug) {
      console.log(
        `OCR completed: ${text.length} characters${isHEICFile(file) ? " [HEIC processed]" : ""}`,
      );
    }

    return text;
  } catch (error) {
    console.error(`OCR error for ${file.getName()}:`, error);
    return "";
  }
}

/**
 * 設定確認
 */
export function validateConfig(): boolean {
  const hasVisionAPI = !!API_KEY;
  const hasFreeConvertAPI = !!FREECONVERT_API_KEY;

  if (!hasVisionAPI) console.error("Google Vision API key is missing");
  if (!hasFreeConvertAPI) console.error("FreeConvert API key is missing");

  return hasVisionAPI && hasFreeConvertAPI;
}

/**
 * テスト実行
 */
function testOCR(): void {
  if (!validateConfig()) return;

  const folder = DriveApp.getFolderById(env.OCR_FOLDER_ID);
  const files = folder.getFiles();

  if (files.hasNext()) {
    const file = files.next();
    runOcr(file, true)
      .then((result) =>
        console.log(`Test result: ${result.length > 0 ? "Success" : "Failed"}`),
      )
      .catch((error) => console.error("Test failed:", error));
  } else {
    console.log("No files found in test folder");
  }
}

// import * as env from "./env";

// const API_KEY = env.CLOUD_VISION_API_KEY;
// const FREECONVERT_API_KEY = env.FREE_CONVERT_API_KEY;
// const FREECONVERT_BASE_URL = "https://api.freeconvert.com/v1";

// /**
//  * HEIC形式判定
//  */
// function isHEICFile(file: GoogleAppsScript.Drive.File): boolean {
//   const fileName = file.getName().toLowerCase();
//   const contentType = file.getBlob().getContentType();

//   return (
//     fileName.endsWith(".heic") ||
//     fileName.endsWith(".heif") ||
//     contentType === "image/heic" ||
//     contentType === "image/heif" ||
//     /^img_\d{4}\.(heic|jpg)$/i.test(fileName)
//   );
// }

// /**
//  * FreeConvert API - ファイルインポート
//  */

// // biome-ignore lint/suspicious/noExplicitAny: <explanation>
// async function createImportTask(): Promise<any> {
//   const response = UrlFetchApp.fetch(
//     `${FREECONVERT_BASE_URL}/process/import/upload`,
//     {
//       method: "post",
//       headers: {
//         Authorization: `Bearer ${FREECONVERT_API_KEY}`,
//         Accept: "application/json",
//       },
//       muteHttpExceptions: true,
//     },
//   );

//   if (
//     response.getResponseCode() !== 200 &&
//     response.getResponseCode() !== 201
//   ) {
//     throw new Error(
//       `Import task creation failed: ${response.getContentText()}`,
//     );
//   }

//   return JSON.parse(response.getContentText());
// }

// /**
//  * FreeConvert API - ファイルアップロード
//  */
// async function uploadFile(
//   file: GoogleAppsScript.Drive.File,
//   // biome-ignore lint/suspicious/noExplicitAny: <explanation>
//   importTask: any,
// ): Promise<void> {
//   const formData = {
//     ...importTask.result.form.parameters,
//     file: file.getBlob(),
//   };

//   const response = UrlFetchApp.fetch(importTask.result.form.url, {
//     method: "post",
//     payload: formData,
//     muteHttpExceptions: true,
//   });

//   if (response.getResponseCode() !== 200) {
//     throw new Error(`File upload failed: ${response.getContentText()}`);
//   }
// }

// /**
//  * FreeConvert API - 変換タスク作成
//  */
// async function createConvertTask(importTaskId: string): Promise<string> {
//   const response = UrlFetchApp.fetch(
//     `${FREECONVERT_BASE_URL}/process/convert`,
//     {
//       method: "post",
//       headers: {
//         Authorization: `Bearer ${FREECONVERT_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       payload: JSON.stringify({
//         input: importTaskId,
//         input_format: "heic",
//         output_format: "jpg",
//         options: { quality: 90 },
//       }),
//       muteHttpExceptions: true,
//     },
//   );

//   if (
//     response.getResponseCode() !== 200 &&
//     response.getResponseCode() !== 201
//   ) {
//     throw new Error(
//       `Convert task creation failed: ${response.getContentText()}`,
//     );
//   }

//   const result = JSON.parse(response.getContentText());
//   return result.id;
// }

// /**
//  * FreeConvert API - タスクステータス確認
//  */

// // biome-ignore lint/suspicious/noExplicitAny: <explanation>
// async function getTaskStatus(taskId: string): Promise<any> {
//   const response = UrlFetchApp.fetch(
//     `${FREECONVERT_BASE_URL}/process/tasks/${taskId}`,
//     {
//       headers: { Authorization: `Bearer ${FREECONVERT_API_KEY}` },
//       muteHttpExceptions: true,
//     },
//   );

//   if (response.getResponseCode() !== 200) {
//     throw new Error("Status check failed");
//   }

//   return JSON.parse(response.getContentText());
// }

// /**
//  * FreeConvert API - 変換完了待機
//  */
// async function waitForConversion(taskId: string): Promise<string> {
//   const maxAttempts = 40;
//   const sleepInterval = 5000;

//   for (let attempt = 0; attempt < maxAttempts; attempt++) {
//     Utilities.sleep(sleepInterval);

//     const status = await getTaskStatus(taskId);

//     if (status.status === "completed") {
//       return status.result.url;
//     }

//     if (status.status === "failed" || status.status === "error") {
//       throw new Error(`Conversion failed: ${JSON.stringify(status)}`);
//     }
//   }

//   throw new Error("Conversion timeout");
// }

// /**
//  * HEIC→JPEG変換
//  */
// async function convertHEICToJPEG(
//   file: GoogleAppsScript.Drive.File,
// ): Promise<GoogleAppsScript.Base.Blob | null> {
//   if (!FREECONVERT_API_KEY) {
//     console.error("FREECONVERT_API_KEY is not configured");
//     return null;
//   }

//   try {
//     const importTask = await createImportTask();
//     await uploadFile(file, importTask);
//     const convertTaskId = await createConvertTask(importTask.id);
//     const downloadUrl = await waitForConversion(convertTaskId);

//     const downloadResponse = UrlFetchApp.fetch(downloadUrl);
//     return downloadResponse
//       .getBlob()
//       .setName(file.getName().replace(/\.heic$/i, ".jpg"));
//   } catch (error) {
//     console.error("HEIC conversion failed:", error);
//     return null;
//   }
// }

// /**
//  * Google Vision API - OCR実行
//  */
// async function performOCR(blob: GoogleAppsScript.Base.Blob): Promise<string> {
//   const base64Image = Utilities.base64Encode(blob.getBytes());
//   const payload = {
//     requests: [
//       {
//         image: { content: base64Image },
//         features: [
//           { type: "TEXT_DETECTION" },
//           { type: "DOCUMENT_TEXT_DETECTION" },
//         ],
//         imageContext: { languageHints: ["ja", "en"] },
//       },
//     ],
//   };

//   const response = UrlFetchApp.fetch(
//     `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
//     {
//       method: "post",
//       contentType: "application/json",
//       payload: JSON.stringify(payload),
//       muteHttpExceptions: true,
//     },
//   );

//   if (response.getResponseCode() !== 200) {
//     throw new Error(`OCR API error: ${response.getContentText()}`);
//   }

//   const result = JSON.parse(response.getContentText());
//   return result.responses?.[0]?.fullTextAnnotation?.text || "";
// }

// /**
//  * メインOCR関数
//  */
// export async function runOcr(
//   file: GoogleAppsScript.Drive.File,
//   debug = false,
// ): Promise<string> {
//   try {
//     let processingBlob: GoogleAppsScript.Base.Blob;

//     if (isHEICFile(file)) {
//       if (debug) console.log(`Converting HEIC file: ${file.getName()}`);

//       const convertedBlob = await convertHEICToJPEG(file);
//       if (convertedBlob) {
//         processingBlob = convertedBlob;
//       } else {
//         if (debug) console.log("HEIC conversion failed, trying direct OCR");
//         processingBlob = file.getBlob();
//       }
//     } else {
//       processingBlob = file.getBlob();
//     }

//     const text = await performOCR(processingBlob);

//     if (debug) {
//       console.log(
//         `OCR completed: ${text.length} characters${isHEICFile(file) ? " [HEIC processed]" : ""}`,
//       );
//     }

//     return text;
//   } catch (error) {
//     console.error(`OCR error for ${file.getName()}:`, error);
//     return "";
//   }
// }

// /**
//  * 設定確認
//  */
// export function validateConfig(): boolean {
//   const hasVisionAPI = !!API_KEY;
//   const hasFreeConvertAPI = !!FREECONVERT_API_KEY;

//   if (!hasVisionAPI) console.error("Google Vision API key is missing");
//   if (!hasFreeConvertAPI) console.error("FreeConvert API key is missing");

//   return hasVisionAPI && hasFreeConvertAPI;
// }

// /**
//  * テスト実行
//  */
// function testOCR(): void {
//   if (!validateConfig()) return;

//   const folder = DriveApp.getFolderById(env.OCR_FOLDER_ID);
//   const files = folder.getFiles();

//   if (files.hasNext()) {
//     const file = files.next();
//     runOcr(file, true)
//       .then((result) =>
//         console.log(`Test result: ${result.length > 0 ? "Success" : "Failed"}`),
//       )
//       .catch((error) => console.error("Test failed:", error));
//   } else {
//     console.log("No files found in test folder");
//   }
// }
