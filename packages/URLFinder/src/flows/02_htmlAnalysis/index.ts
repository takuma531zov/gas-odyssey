import type { ContactPageResult, StrategyResult } from "../../common/types";
import type { SearchStateData } from "../../common/types";
import { isSuccessfulFormUrl } from "../../common/state";
import { fetchUrl, getDetailedNetworkError } from "../../common/network/fetch";
import {
  findGoogleFormUrlsOnly,
  findEmbeddedHTMLForm,
  isValidContactForm,
  detectGoogleForms,
} from "./extractor";
import {
  getContentWithEncoding,
  searchInNavigation,
  analyzeAnchorSection,
  findSecondStageFormLink,
} from "./parser";
import { isAnchorLink } from "../../common/network/validation";

/** ---------------------------------------------
 *  searchMethod を定数化
 * --------------------------------------------- */
const METHOD = {
  HOMEPAGE_GOOGLE_FORM: "homepage_google_form_fallback",
  HOMEPAGE_LINK_FALLBACK: "homepage_link_fallback",
  HOMEPAGE_EMBEDDED: "homepage_embedded_fallback",
  NAV_FORM: "homepage_navigation_form",
  NAV_GFORMS: "homepage_navigation_google_forms",
  NAV_KEYWORD: "homepage_navigation_keyword_based",
  DNS_ERROR: "dns_error",
  TIMEOUT_ERROR: "timeout_error",
  BOT_BLOCKED: "bot_blocked",
  ERROR: "error",
} as const;

/**
 * HTML Analysis 検索戦略
 * - トップページ取得 → Googleフォーム検出 → ナビから候補抽出 → 候補ページでフォーム検証
 * - 埋め込みフォーム検出 → 見つからない場合は null
 */
export const htmlAnalysisSearch = (
  baseUrl: string,
  searchState: SearchStateData,
): StrategyResult => {
  /** ① トップページを取得（ネットワークエラーは種類別に分類して返却） */
  let response: ReturnType<typeof fetchUrl>;
  try {
    response = fetchUrl(baseUrl);
  } catch (homepageError) {
    return { result: handleNetworkError(homepageError), newState: searchState };
  }
  if (response instanceof Error) {
    return { result: handleNetworkError(response), newState: searchState };
  }

  /** ② 文字コード考慮で HTML を取得 */
  const html = getContentWithEncoding(response);

  /** ③ トップページに Google フォームがあるか）
  // → ある場合は即確定で返す（actualFormUrl に Google フォーム URL）
  */
  const googleFormUrls = findGoogleFormUrlsOnly(html);
  if (googleFormUrls) {
    return {
      result: {
        contactUrl: baseUrl,
        actualFormUrl: googleFormUrls,
        foundKeywords: ["homepage_google_form"],
        searchMethod: METHOD.HOMEPAGE_GOOGLE_FORM,
      },
      newState: searchState,
    };
  }

  /** ④ HTML を解析してナビゲーション等から「問い合わせリンク候補」を抽出 */
  const { result, newState } = analyzeHtmlContent(html, baseUrl, searchState);
  if (result?.contactUrl) {
    // ④-1 候補ページから「実フォーム URL」を確定（GoogleForm / 埋め込み / 二段階遷移）
    const formUrl = findActualForm(result.contactUrl);
    result.actualFormUrl = formUrl;
    result.searchMethod = METHOD.HOMEPAGE_LINK_FALLBACK;

    // ④-2 実フォームが http なら確信度高い
    if (result.actualFormUrl?.startsWith("http")) {
      return { result, newState };
    }

    // ④-3 埋め込みフォーム検出時は contactUrl 自体が実フォーム
    if (result.actualFormUrl === "embedded_contact_form_on_page") {
      result.actualFormUrl = result.contactUrl;
      return { result, newState };
    }

    // ④-4 それ以外でも見つかった内容で返す（ロジック維持）
    return { result, newState };
  }

  /** ⑤ トップページ自体に埋め込みフォームが無いか最終チェック */
  const embeddedFormResult = findEmbeddedHTMLForm(html);
  if (embeddedFormResult) {
    return {
      result: {
        contactUrl: baseUrl,
        actualFormUrl: baseUrl,
        foundKeywords: ["homepage_embedded_form"],
        searchMethod: METHOD.HOMEPAGE_EMBEDDED,
      },
      newState,
    };
  }

  /** ⑥ 見つからない場合は null（他戦略へバトン） */
  return { result: null, newState };
};

/** ------------------------------------------------
 * ネットワークエラー処理（種類別の searchMethod に分類）
 * ------------------------------------------------ */
const handleNetworkError = (error: Error | unknown): ContactPageResult => {
  const detailedError = getDetailedNetworkError(error);
  console.log(`Error in homepage analysis fallback: ${detailedError}`);

  let searchMethod: string;
  if (detailedError.includes("DNS解決失敗")) {
    searchMethod = METHOD.DNS_ERROR;
  } else if (detailedError.includes("timeout")) {
    searchMethod = METHOD.TIMEOUT_ERROR;
  } else if (
    detailedError.includes("403") ||
    detailedError.includes("501") ||
    detailedError.includes("Access forbidden")
  ) {
    searchMethod = METHOD.BOT_BLOCKED;
  } else {
    searchMethod = METHOD.ERROR;
  }

  return {
    contactUrl: null,
    actualFormUrl: null,
    foundKeywords: [detailedError],
    searchMethod,
  };
};

/** ------------------------------------------------
 * HTMLコンテンツ分析（ナビゲーション→候補ページ検証の本体）
 * ------------------------------------------------ */
const analyzeHtmlContent = (
  html: string,
  baseUrl: string,
  searchState: SearchStateData,
): StrategyResult => {
  // A) ナビゲーション等から「問い合わせ候補リンク」を抽出
  const navResult = searchInNavigation(html, baseUrl);
  const { url, score, keywords } = navResult;

  // A-1) URL が取れない or スコアが低い → 失敗
  if (!url || score <= 0) {
    return { result: null, newState: searchState };
  }

  // A-2) 既に成功済みの URL はスキップ（重複回避）
  if (isSuccessfulFormUrl(searchState, url)) {
    return { result: null, newState: searchState };
  }

  // B) ページ内リンク（#contact 等）の場合は同一 HTML をセクション解析
  if (isAnchorLink(url)) {
    const anchorSectionResult = analyzeAnchorSection(html, url, baseUrl);
    if (anchorSectionResult.contactUrl) {
      return { result: anchorSectionResult, newState: searchState };
    }
  }

  // C) 別ページの場合は GET して候補ページの中身を検証
  let response: ReturnType<typeof fetchUrl>;
  try {
    response = fetchUrl(url);
  } catch (error) {
    return { result: handleNetworkError(error), newState: searchState };
  }
  if (response instanceof Error) {
    return { result: handleNetworkError(response), newState: searchState };
  }
  if (response.getResponseCode() !== 200) {
    return { result: null, newState: searchState };
  }

  const candidateHtml = response.getContentText();

  // C-1) そのページ自体が「有効なフォーム」なら即確定
  if (isValidContactForm(candidateHtml)) {
    return {
      result: {
        contactUrl: url,
        actualFormUrl: url,
        foundKeywords: [...keywords, "form_validation_success"],
        searchMethod: METHOD.NAV_FORM,
      },
      newState: searchState,
    };
  }

  // C-2) Google フォーム埋め込み / 遷移の検出
  const googleFormsResult = detectGoogleForms(candidateHtml);
  if (googleFormsResult.found && googleFormsResult.url) {
    return {
      result: {
        contactUrl: url,
        actualFormUrl: googleFormsResult.url,
        foundKeywords: [...keywords, "google_forms", googleFormsResult.type],
        searchMethod: METHOD.NAV_GFORMS,
      },
      newState: searchState,
    };
  }

  // C-3) キーワード密度が高いなら「問い合わせ濃厚」と判断
  if (score >= 15) {
    return {
      result: {
        contactUrl: url,
        actualFormUrl: url,
        foundKeywords: [...keywords, "keyword_based_validation"],
        searchMethod: METHOD.NAV_KEYWORD,
      },
      newState: searchState,
    };
  }

  // C-4) ここまでで確定できない場合は失敗（他戦略へ）
  return { result: null, newState: searchState };
};

/** ------------------------------------------------
 * 実際のフォーム URL を確定（GoogleForm / 埋め込み / 二段階遷移）
 * ------------------------------------------------ */
const findActualForm = (contactPageUrl: string): string | null => {
  try {
    const response = fetchUrl(contactPageUrl);
    if (response instanceof Error) {
      console.error(`Error fetching contact page ${contactPageUrl}:`, response);
      return null;
    }

    const html = response.getContentText();

    // 1) Google フォーム直リンク（http～）ならそれを返す
    const googleFormUrl = findGoogleFormUrlsOnly(html);
    if (googleFormUrl?.startsWith("http")) {
      return googleFormUrl;
    }

    // 2) ページ内に埋め込みフォームがある場合は、このページ自体が実フォーム
    if (findEmbeddedHTMLForm(html)) {
      return contactPageUrl;
    }

    // 3) 「次のページで入力」など二段階導線を辿る
    return findSecondStageFormLink(html, contactPageUrl);
  } catch (error) {
    console.error(`Error fetching contact page ${contactPageUrl}:`, error);
    return null;
  }
};
