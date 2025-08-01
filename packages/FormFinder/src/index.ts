import { Step1TargetListService } from './services/step1-target-list';
import { Step2KeywordAccessService } from './services/step2-keyword-access';
import { Step3FormExtractionService } from './services/step3-form-extraction';
import { Step4TopPageAnalysisService } from './services/step4-top-page-analysis';
import { Step5GoogleFormDetectionService } from './services/step5-google-form-detection';
import { Step6ErrorStatusService } from './services/step6-error-status';
import { HtmlDebugService } from './services/html-debug';
import { Logger } from './utils/logger';
import { Environment } from './utils/env';
import { RATE_LIMIT_CONFIG } from './utils/constants';

/**
 * 新仕様: 営業リスト問い合わせフォーム抽出システム
 * 6ステップフローによる処理（stepファイル分割版）
 */
async function processFormFinder(): Promise<void> {
  Logger.info('FormFinder処理開始');
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 4.5 * 60 * 1000; // 4.5分でタイムアウト

  try {
    // 各ステップサービスの初期化
    const step1Service = new Step1TargetListService();
    const step2Service = new Step2KeywordAccessService();
    const step3Service = new Step3FormExtractionService();
    const step4Service = new Step4TopPageAnalysisService();
    const step5Service = new Step5GoogleFormDetectionService();
    const step6Service = new Step6ErrorStatusService();

    // Step1: 対象リスト抽出
    const targetRows = step1Service.execute();

    if (targetRows.length === 0) {
      Logger.info('処理対象がありません');
      return;
    }

    Logger.info(`処理開始: ${targetRows.length}件`);

    // 1行ずつ順次処理（新仕様）
    for (let i = 0; i < targetRows.length; i++) {
      // タイムアウトチェック
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_EXECUTION_TIME) {
        Logger.warn(`タイムアウト: 4.5分経過により処理を停止します。処理済み: ${i}/${targetRows.length}件`);
        break;
      }

      const company = targetRows[i];
      if (!company) {
        Logger.warn(`処理対象データが不正です: ${i + 1}行目`);
        continue;
      }

      Logger.info(`処理中 (${i + 1}/${targetRows.length}): ${company.homepageUrl} [経過時間: ${Math.round(elapsedTime/1000)}秒]`);

      try {
        await processSingleCompany(
          company.row,
          company.homepageUrl,
          step2Service,
          step3Service,
          step4Service,
          step5Service,
          step6Service
        );

      } catch (error) {
        Logger.error(`企業処理エラー: ${company.homepageUrl}`, error);
        // Step6: エラーステータス出力
        step6Service.executeForProcessingError(company.row);
      }

      // 次の行処理前に待機（レート制限対策・動的待機時間）
      if (i < targetRows.length - 1) {
        Utilities.sleep(RATE_LIMIT_CONFIG.COMPANY_PROCESSING_DELAY);
      }
    }

    Logger.info('FormFinder処理完了');

  } catch (error) {
    Logger.error('FormFinder処理中に致命的エラーが発生', error);
    throw error;
  }
}

/**
 * 1企業の6ステップフロー処理（stepファイル分割版）
 */
async function processSingleCompany(
  row: number,
  homepageUrl: string,
  step2Service: Step2KeywordAccessService,
  step3Service: Step3FormExtractionService,
  step4Service: Step4TopPageAnalysisService,
  step5Service: Step5GoogleFormDetectionService,
  step6Service: Step6ErrorStatusService
): Promise<void> {

  // Step2: キーワード付きURL順次アクセス
  Logger.debug(`Step2: キーワード付きURL順次アクセス - ${homepageUrl}`);
  const step2Result = await step2Service.execute(homepageUrl);

  if (step2Result.success && step2Result.url && step2Result.html) {
    // Step3: フォーム要素抽出 + スプレッドシート出力
    Logger.debug(`Step3: フォーム要素抽出 + スプレッドシート出力 - ${step2Result.url}`);
    const step3Success = step3Service.execute(row, step2Result.url, step2Result.html);

    if (step3Success) {
      return; // Step3で成功したので処理終了
    }
    // Step3で<form>要素が見つからない場合は、Step4に続行
    Logger.debug('Step3で<form>要素が見つからないため、Step4に進みます');
  } else if (step2Result.shouldCheckGoogleForm && step2Result.url && step2Result.html) {
    // Googleフォーム優先検出の場合は直接Step5へ
    Logger.debug(`Step2でGoogleフォームリンクを検出、Step5へ進みます - ${step2Result.url}`);
    const googleFormUrls = step5Service.extractGoogleFormUrls(step2Result.html);

    if (googleFormUrls.length > 0) {
      // ヒットした場合: 該当URLにアクセスして<form>要素抽出
      for (const googleFormUrl of googleFormUrls) {
        const googleFormResult = await step5Service.fetchGoogleFormHtml(googleFormUrl);

        if (googleFormResult.success && googleFormResult.html) {
          const googleFormStructure = step3Service.saveFormStructureOnly(row, googleFormResult.html, googleFormUrl);

          if (googleFormStructure) {
            Logger.debug(`Step5成功: Googleフォーム発見 - ${googleFormUrl}`);
            const step5Success = step3Service.execute(row, googleFormUrl, googleFormResult.html);

            if (step5Success) {
              return; // Googleフォーム発見で処理終了
            }
          }
        }

        // 複数候補がある場合のレート制限対策（動的待機時間）
        Utilities.sleep(RATE_LIMIT_CONFIG.GOOGLE_FORM_PROCESSING_DELAY);
      }
    }
  }

  // Step4: トップページHTML取得・解析
  Logger.debug(`Step4: トップページHTML取得・解析 - ${homepageUrl}`);
  const step4Result = await step4Service.execute(homepageUrl);

  if (!step4Result.success || !step4Result.html) {
    // Step6: 詳細エラーステータス出力
    Logger.warn(`Step4失敗: トップページHTML取得不可 - ${homepageUrl}`);

    if (step4Result.errorDetail) {
      step6Service.executeForTopPageErrorWithDetail(row, step4Result.errorDetail);
    } else {
      step6Service.executeForTopPageError(row);
    }
    return;
  }

  // Step4でフォーム要素の抽出を試行
  const topPageFormStructure = step3Service.saveFormStructureOnly(row, step4Result.html, homepageUrl);

  if (topPageFormStructure) {
    // フォームが見つかった場合: Step3と同様の出力処理
    Logger.debug('Step4でフォーム要素を発見');
    const step4FormSuccess = step3Service.execute(row, homepageUrl, step4Result.html);

    if (step4FormSuccess) {
      return; // フォーム発見で処理終了
    }
  }

  // Step5: Googleフォーム検出・抽出
  Logger.debug('Step5: Googleフォーム検出・抽出');
  const googleFormUrls = step5Service.extractGoogleFormUrls(step4Result.html);

  if (googleFormUrls.length > 0) {
    // ヒットした場合: 該当URLにアクセスして<form>要素抽出
    for (const googleFormUrl of googleFormUrls) {
      const googleFormResult = await step5Service.fetchGoogleFormHtml(googleFormUrl);

      if (googleFormResult.success && googleFormResult.html) {
        const googleFormStructure = step3Service.saveFormStructureOnly(row, googleFormResult.html, googleFormUrl);

        if (googleFormStructure) {
          Logger.debug(`Step5成功: Googleフォーム発見 - ${googleFormUrl}`);
          const step5Success = step3Service.execute(row, googleFormUrl, googleFormResult.html);

          if (step5Success) {
            return; // Googleフォーム発見で処理終了
          }
        }
      }

      // 複数候補がある場合のレート制限対策（動的待機時間）
      Utilities.sleep(RATE_LIMIT_CONFIG.GOOGLE_FORM_PROCESSING_DELAY);
    }
  }

  // Step6: エラーステータス出力
  // フォームが見つからない場合のステータス記録
  Logger.warn(`全ステップでフォームが見つかりませんでした: ${homepageUrl}`);
  step6Service.executeWithStandardMessage(row);
}

// GAS用グローバル関数
function runFormFinder(): void {
  processFormFinder();
}

function setupFormFinder(config: {
  sheetName?: string;
}): void {
  const props: any = {};

  if (config.sheetName) {
    props.sheetName = config.sheetName;
  }

  Environment.setupProperties(props);
  Logger.info('FormFinder設定を保存しました');
}

function debugSpreadsheet(): void {
  try {
    const step1Service = new Step1TargetListService();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    Logger.info(`スプレッドシート名: ${spreadsheet.getName()}`);
    Logger.info(`設定されたシート名: ${Environment.SHEET_NAME || 'なし'}`);

    // 全シート名を表示
    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(s => s.getName());
    Logger.info(`利用可能なシート: ${sheetNames.join(', ')}`);

    // 対象行の確認
    const targetRows = step1Service.execute();
    Logger.info(`処理対象行数: ${targetRows.length}`);

    if (targetRows.length > 0) {
      Logger.info(`最初の3件: ${JSON.stringify(targetRows.slice(0, 3))}`);
    }

  } catch (error) {
    Logger.error('デバッグ中にエラーが発生', error);
  }
}

// ログレベル設定用の関数
function setLogLevel(level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'): void {
  Logger.setLogLevel(level);
}

// 現在のログレベル確認用の関数
function getLogLevel(): void {
  Logger.info(`現在のログレベル: ${Logger.getLogLevel()}`);
}

// =====================================================
// HTMLデバッグ関数群（統合版）
// =====================================================

/**
 * AP列最終行のURLのHTML構造を詳細出力するデバッグ関数
 */
function debugHtmlStructure(): void {
  const debugService = new HtmlDebugService();
  debugService.debugLastTargetRow();
}

