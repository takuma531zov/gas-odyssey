// URLパターン検索戦略（Step 2-1）
// 目的: /contact, /inquiry など一般的な問い合わせURLパターンを高速に試し、
//       最短でフォーム/Googleフォームの有無を確定させる
// フロー:
//   1) タイムアウト管理しつつ高優先度パターンを順次試行
//   2) 2URL以上を検証済みなら、HTML同一性からSPAを検出 → アンカー解析
//   3) 問い合わせページ妥当性をチェック（明確な除外条件）
//   4) HTMLフォーム or Googleフォームの検出で即確定
//   5) 未確定なら候補として状態に蓄積（次戦略・フォールバックで活用）
import type { StrategyResult, SearchStateData } from '../../common/types';
import { addValidUrl, addSuccessfulFormUrl, addCandidate } from '../../common/state';
import { maxTotalTime } from '../../env';
import { fetchUrl, getDetailedNetworkError, getDetailedErrorMessage } from '../../common/network/fetch';
import { isValidContactForm, detectGoogleForms } from '../02_htmlAnalysis/extractor';
import { detectSameHtmlPattern, isValidContactPage, executeSPAAnalysis } from '../02_htmlAnalysis/parser';
import { HIGH_PRIORITY_PATTERNS } from './constants';

// メイン: URLパターン検索戦略を実行
export const urlPatternSearch = (baseUrl: string, searchState: SearchStateData): StrategyResult => {
  const startTime = Date.now();
  const testedUrls: string[] = [];
  let currentState = searchState;

  // 1) 高優先度パターンを順次試行（タイムアウト監視）
  for (const pattern of HIGH_PRIORITY_PATTERNS) {
    if (Date.now() - startTime > maxTotalTime) {
      console.log('Timeout during priority search');
      break;
    }

    // 候補URLを生成（末尾スラッシュを正規化）
    const testUrl = baseUrl.replace(/\/$/, '') + pattern;
    testedUrls.push(testUrl);

    let response: GoogleAppsScript.URL_Fetch.HTTPResponse | Error;
    try {
      // ネットワークアクセス（例外抑制ラッパー）
      response = fetchUrl(testUrl);
    } catch (error) {
      const detailedError = getDetailedNetworkError(error);
      if (detailedError.includes('DNS解決失敗')) {
        return { result: { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: 'dns_error' }, newState: currentState };
      }
      continue;
    }

    if (response instanceof Error) {
      const detailedError = getDetailedNetworkError(response);
      if (detailedError.includes('DNS解決失敗')) {
        return { result: { contactUrl: null, actualFormUrl: null, foundKeywords: [detailedError], searchMethod: 'dns_error' }, newState: currentState };
      }
      continue;
    }

    // 2xx 以外はスキップ（403/501 はボットブロックとして即終了）
    if (response.getResponseCode() !== 200) {
      const statusCode = response.getResponseCode();
      if (statusCode === 403 || statusCode === 501) {
        return { result: { contactUrl: null, actualFormUrl: null, foundKeywords: [getDetailedErrorMessage(statusCode)], searchMethod: 'bot_blocked' }, newState: currentState };
      }
      continue;
    }

    const html = response.getContentText();

    // 2) 同一HTML検出でSPAの可能性 → アンカー解析
    if (testedUrls.length >= 2) {
        const { isSame, newState: nextState } = detectSameHtmlPattern(testedUrls, html, currentState);
        currentState = nextState;
        if (isSame) {
            const anchorResult = executeSPAAnalysis(html, baseUrl);
            if (anchorResult.contactUrl) return { result: anchorResult, newState: currentState };
        }
    }

    // 3) 明確な除外パターンなどで非対象をスキップ
    if (!isValidContactPage(html)) continue;

    currentState = addValidUrl(currentState, testUrl, pattern);

    // 4) HTMLフォーム検出 → 即確定
    if (isValidContactForm(html)) {
      currentState = addSuccessfulFormUrl(currentState, testUrl);
      return { result: { contactUrl: testUrl, actualFormUrl: testUrl, foundKeywords: [pattern.replace(/\//g, ''), 'contact_form_confirmed'], searchMethod: 'contact_form_priority_search' }, newState: currentState };
    }

    // Googleフォーム検出 → 即確定
    const googleFormsResult = detectGoogleForms(html);
    if (googleFormsResult.found && googleFormsResult.url) {
      currentState = addSuccessfulFormUrl(currentState, testUrl);
      return { result: { contactUrl: testUrl, actualFormUrl: googleFormsResult.url, foundKeywords: [pattern.replace(/\//g, ''), 'google_forms', googleFormsResult.type], searchMethod: 'google_forms_priority_search' }, newState: currentState };
    }

    // 5) 未確定 → 候補として蓄積（後続戦略・フォールバックで評価）
    currentState = addCandidate(currentState, testUrl, 'no_contact_form', html);
  }

  return { result: null, newState: currentState };
};
