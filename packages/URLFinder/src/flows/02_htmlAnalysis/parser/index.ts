// HTML解析（パーサ）層
// 目的: トップページや候補HTMLから「問い合わせ導線/フォームの有無」を判定し、
//       信頼度スコア付きの候補や実フォームURLを抽出する。
// 構成:
//   1) 重複HTML検出（SPA検出補助）
//   2) SPAナビゲーション探索（アンカー導線）
//   3) アンカーセクション解析（#id 近傍のフォーム検出）
//   4) 問い合わせ純度スコアリング（URL/文言の重みづけ）
//   5) ナビゲーション内リンク抽出（候補列挙→スコア）
//   6) 2段階導線（遷移先）探索（問い合わせページ→実フォーム）
//   7) 文字コードに応じた本文取得（UTF-8/SJIS/EUC-JP）
import type {
  ContactPageResult,
  PurityResult,
  HtmlSearchResult,
} from "../../../common/types";
import {
  hashString,
  isAnchorLink,
  isValidEncoding,
} from "../../../common/network/validation";
import {
  resolveUrl,
  isHomepageUrl,
  fetchUrl,
} from "../../../common/network/fetch";
import * as FormUtils from "../extractor";
import type { SearchStateData } from "../../../common/types";
import { getHtmlCache, setHtmlCache } from "../../../common/state";
import {
  FORM_LINK_PATTERNS,
  FORM_TEXT_PATTERNS,
  CONTACT_URL_PATTERNS,
  NAVIGATION_SELECTORS,
  INVALID_PAGE_PATTERNS,
  ANCHOR_SECTION_PATTERNS,
  HTML_HIGH_PRIORITY_CONTACT_KEYWORDS,
  HTML_MEDIUM_PRIORITY_CONTACT_KEYWORDS,
  HTML_EXCLUDED_KEYWORDS,
  ANCHOR_SECTION_CONTACT_KEYWORDS,
  FORM_LINK_NEGATIVE_KEYWORDS,
} from "./constants";

// ================================
// 1) 重複HTML検出（関数型）
// -------------------------------
// 目的: 直近に取得した複数URLのHTMLハッシュを比較し、同一/類似HTMLが連続していないかを判定。
//       同一が一定回数以上なら「SPA的にコンテンツが動的切替されている」可能性を示唆。
// 入力: urls        - 比較対象のURL配列
//       htmlContent - 現在解析中HTML
//       searchState - HTMLハッシュのキャッシュを含む状態
// 出力: { isSame, newState } - isSame=trueで「同一パターン頻発」、newStateはキャッシュ更新後の状態
// 備考: 状態（キャッシュ）は不変性維持のため newState として返す。
export const detectSameHtmlPattern = (
  urls: string[],
  htmlContent: string,
  searchState: SearchStateData,
): { isSame: boolean; newState: SearchStateData } => {
  const contentHash = hashString(htmlContent);
  let sameCount = 0;
  let newState = searchState;

  for (const url of urls) {
    const cachedHash = getHtmlCache(newState, url);
    if (cachedHash === contentHash) {
      // 同じハッシュが見つかった場合はカウント（同一/極めて類似HTML）
      sameCount++;
    } else {
      // 新規ハッシュとしてキャッシュに保存（状態を新しい参照で返す）
      newState = setHtmlCache(newState, url, contentHash);
    }
  }
  // 「2回以上の一致」でSPA的挙動の可能性が高いとみなす
  return { isSame: sameCount >= 2, newState };
};

// ================================
// 2) SPAナビゲーション解析（関数型）
// -------------------------------
// 目的: ナビゲーションからアンカー（#id）導線を検出し、該当セクションにフォーム/埋め込みがあるかを即判定。
// 入力: html     - トップページHTML
//       baseUrl - 基準URL
// 出力: ContactPageResult - 成功: contactUrl/actualFormUrl 等をセット、失敗: null相当の結果
// 備考: 例外時も ContactPageResult を返し、検索を継続可能にする。
export const executeSPAAnalysis = (
  html: string,
  baseUrl: string,
): ContactPageResult => {
  try {
    const navResult = searchInNavigation(html, baseUrl);
    if (navResult.url && isAnchorLink(navResult.url)) {
      // #id 形式のページ内導線 → 対象セクションを抽出してフォーム検出
      const anchorSectionResult = analyzeAnchorSection(
        html,
        navResult.url,
        baseUrl,
      );
      if (anchorSectionResult.contactUrl) {
        anchorSectionResult.searchMethod = "spa_anchor_analysis";
        anchorSectionResult.foundKeywords.push("spa_detected");
        return anchorSectionResult;
      }
    }
    // アンカー導線は検出されたが、セクション内でフォーム検出に失敗
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ["spa_detected", "anchor_analysis_failed"],
      searchMethod: "spa_analysis_failed",
    };
  } catch (error) {
    // 解析処理中に例外発生（後続戦略への影響を避けるため失敗結果で返却）
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ["spa_detected", "spa_analysis_error"],
      searchMethod: "spa_analysis_error",
    };
  }
};

// ================================
// 3) 問い合わせ純度スコアリング（関数型）
// -------------------------------
// 目的: URL と リンク文面から「問い合わせらしさ」を加点/減点ルールで数値化し、根拠を記録。
// 入力: url, linkText
// 出力: PurityResult { score, reasons[] } - 理由はデバッグ/透明性のため文字列で残す。
// ルール例:
//   - 高優先度キーワード（/contact, お問い合わせ, etc.）: +8〜+10
//   - 中優先度キーワード: +2〜+3
//   - 除外キーワード（採用/お知らせ等）: 大幅減点
//   - URL構造ボーナス（/contact 等）: +15
//   - 純度低下URL（/about, /company 等）: -5
export const calculateContactPurity = (
  url: string,
  linkText: string,
): PurityResult => {
  let score = 0;
  const reasons: string[] = [];
  const foundKeywords = new Set<string>();

  const lowerUrl = url.toLowerCase();
  const lowerLinkText = linkText.toLowerCase();

  // 除外キーワード: 見つかり次第、大幅に減点して即返す（ノイズ除去の強いフィルタ）
  const excludedMatch = HTML_EXCLUDED_KEYWORDS.find(
    (keyword) =>
      lowerUrl.includes(keyword.toLowerCase()) ||
      lowerLinkText.includes(keyword.toLowerCase()),
  );

  if (excludedMatch) {
    score -= 15;
    reasons.push(`excluded:${excludedMatch}`);
    return { score, reasons };
  }

  // 高優先度キーワード: テキスト命中を重く、URL命中も加点（重複加点防止のためSetで制御）
  for (const keyword of HTML_HIGH_PRIORITY_CONTACT_KEYWORDS) {
    const normalizedKeyword = keyword.toLowerCase();
    if (
      (lowerLinkText.includes(normalizedKeyword) ||
        lowerUrl.includes(normalizedKeyword)) &&
      !foundKeywords.has(normalizedKeyword)
    ) {
      if (lowerLinkText.includes(normalizedKeyword)) {
        score += 10;
        reasons.push(`high_priority_text:${keyword}`);
      } else if (lowerUrl.includes(normalizedKeyword)) {
        score += 8;
        reasons.push(`high_priority_url:${keyword}`);
      }
      foundKeywords.add(normalizedKeyword);
    }
  }

  // 中優先度キーワード: 高優先度より軽めの加点
  for (const keyword of HTML_MEDIUM_PRIORITY_CONTACT_KEYWORDS) {
    const normalizedKeyword = keyword.toLowerCase();
    if (
      (lowerLinkText.includes(normalizedKeyword) ||
        lowerUrl.includes(normalizedKeyword)) &&
      !foundKeywords.has(normalizedKeyword)
    ) {
      if (lowerLinkText.includes(normalizedKeyword)) {
        score += 3;
        reasons.push(`medium_priority_text:${keyword}`);
      } else if (lowerUrl.includes(normalizedKeyword)) {
        score += 2;
        reasons.push(`medium_priority_url:${keyword}`);
      }
      foundKeywords.add(normalizedKeyword);
    }
  }

  // URLパターンボーナス: /contact 等の構造的シグナルを強く評価
  const urlPattern = CONTACT_URL_PATTERNS.find((pattern) =>
    lowerUrl.includes(pattern),
  );
  if (urlPattern) {
    score += 15;
    reasons.push(`strong_contact_url_structure:${urlPattern}`);
  }

  // URLペナルティ: サービス紹介や会社概要等は問い合わせ純度が相対的に低い
  if (lowerUrl.includes("/service/")) {
    score -= 10;
    reasons.push("service_url_penalty");
  } else if (
    lowerUrl.includes("/about/") ||
    lowerUrl.includes("/company/") ||
    lowerUrl.includes("/info/")
  ) {
    score -= 5;
    reasons.push("impure_url_structure");
  }

  return { score, reasons };
};

// ================================
// 4) ナビゲーション探索（関数型）
// -------------------------------
// 目的: ヘッダ/メニュー領域から問い合わせ候補リンクを抽出し、最良候補を返す。
// 入力: html, baseUrl
// 出力: HtmlSearchResult - 最良候補（url/keywords/score/reasons）
// 備考: 高優先度キーワードを含む候補を優先し、スコア最大のものを返却。
export const searchInNavigation = (
  html: string,
  baseUrl: string,
): HtmlSearchResult => {
  const allCandidates: HtmlSearchResult[] = [];

  // ナビゲーション領域の抽出。パターンごとに一致塊を拾い、そこから aタグを精査。
  for (const regex of NAVIGATION_SELECTORS) {
    const matches = html.match(regex) || [];
    for (const match of matches) {
      const candidates = extractAllContactLinks(match, baseUrl, "navigation");
      allCandidates.push(...candidates);
    }
  }

  // 問い合わせ高優先キーワードを含む候補のみを抽出
  const contactLinks = allCandidates.filter((candidate) =>
    HTML_HIGH_PRIORITY_CONTACT_KEYWORDS.some(
      (keyword) =>
        candidate.url?.toLowerCase().includes(keyword.toLowerCase()) ||
        candidate.keywords.some((k) =>
          k.toLowerCase().includes(keyword.toLowerCase()),
        ),
    ),
  );

  // 最良の1件を返す（なければ空の結果）
  if (contactLinks.length > 0) {
    return contactLinks.reduce((max, current) =>
      current.score > max.score ? current : max,
    );
  }

  return {
    url: null,
    keywords: [],
    score: 0,
    reasons: [],
    linkText: "",
    context: "general",
  };
};

// ================================
// 5) 問い合わせリンク抽出（関数型）
// -------------------------------
// 目的: aタグから問い合わせに該当し得るリンクを列挙し、スコア順に返却。
// 入力: content - HTML部分片（ナビ領域等）
//       baseUrl - 基準URL
//       context - 'navigation' 等、候補検出の文脈
// 出力: HtmlSearchResult[] - スコア降順に整列
// 備考: navigation文脈では軽いボーナス（+5）を付与。
export const extractAllContactLinks = (
  content: string,
  baseUrl: string,
  context: HtmlSearchResult["context"],
): HtmlSearchResult[] => {
  const candidates: HtmlSearchResult[] = [];
  const linkRegex = /<a[^>]*href=['"]([^'"\\]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
  // aタグを逐次走査して候補を積み上げる
  for (let match = linkRegex.exec(content); match !== null; match = linkRegex.exec(content)) {
    const url = match[1];
    const linkText = match[2];

    if (!url || !linkText) continue;
    if (
      url.startsWith("mailto:") ||
      url.startsWith("javascript:") ||
      url.startsWith("tel:")
    )
      continue;

    // aタグ内テキスト（HTML除去）の整形
    const cleanLinkText = linkText.replace(/<[^>]*>/g, "").trim();

    // 問い合わせ高優先キーワードをURL/テキストいずれかに含むか
    const hasContactKeywords = HTML_HIGH_PRIORITY_CONTACT_KEYWORDS.some(
      (keyword) =>
        url.toLowerCase().includes(keyword.toLowerCase()) ||
        cleanLinkText.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (!hasContactKeywords) continue;

    // 除外キーワード（採用/ニュース等）を含む候補は除外
    const hasExcludedKeywords = HTML_EXCLUDED_KEYWORDS.some(
      (keyword) =>
        url.toLowerCase().includes(keyword.toLowerCase()) ||
        cleanLinkText.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (hasExcludedKeywords) continue;

    // 純度スコアを算出し、ナビ文脈ボーナスを加算
    const purityResult = calculateContactPurity(url, cleanLinkText);
    const totalScore = purityResult.score + 5; // navigation context bonus

    if (totalScore > 0) {
      // 相対URL→絶対URLへ解決し、候補として追加
      const fullUrl = resolveUrl(baseUrl)(url);
      candidates.push({
        url: fullUrl,
        keywords: purityResult.reasons.map((r) => r.split(":")[1] || r),
        score: totalScore,
        reasons: [...purityResult.reasons, "navigation_context_bonus"],
        linkText: cleanLinkText,
        context,
      });
    }
  }

  // スコア降順（より問い合わせらしいものを先頭へ）
  return candidates.sort((a, b) => b.score - a.score);
};

// ================================
// 6) 問い合わせページ妥当性（関数型）
// -------------------------------
// 目的: 明確な除外パターンを含まず、最低限のボリューム（>500文字）があるかを判定。
// 備考: 軽量な「ページ品質」フィルタとして利用。
export const isValidContactPage = (html: string): boolean => {
  const hasInvalidContent = INVALID_PAGE_PATTERNS.some((pattern) =>
    html.toLowerCase().includes(pattern.toLowerCase()),
  );
  return !hasInvalidContent && html.length > 500;
};

// ================================
// 7) 文字コード考慮付き本文取得（関数型）
// -------------------------------
// 目的: レスポンス本文を UTF-8 / Shift_JIS / EUC-JP の順に試行し、
//       妥当と判定できる文字列を返す。全滅の場合はデフォルトの getContentText()。
// 備考: サイト側のエンコーディング混在に耐性を持たせるためのフォールバック。
export const getContentWithEncoding = (
  response: GoogleAppsScript.URL_Fetch.HTTPResponse,
): string => {
  const encodings = ["utf-8", "shift_jis", "euc-jp"];
  for (const encoding of encodings) {
    try {
      const content = response.getContentText(encoding);
      if (isValidEncoding(content)) {
        return content;
      }
    } catch (e) {
      // 次のエンコーディングを試行
    }
  }
  return response.getContentText();
};

// ================================
// アンカーセクション解析（関数型）
// -------------------------------
// 目的: #id で示されるセクション近傍からフォーム/Googleフォームの埋め込みを検出。
// 入力: html      - 全体HTML
//       anchorUrl - #id を含むURL
//       baseUrl   - 基準URL（結果の contactUrl/actualFormUrl 用）
// 出力: ContactPageResult - 見つかった場合は contactUrl/baseUrl 等を返す。
export const analyzeAnchorSection = (
  html: string,
  anchorUrl: string,
  baseUrl: string,
): ContactPageResult => {
  try {
    // #以降のアンカーIDを抽出
    const anchorMatch = anchorUrl.match(/#(.+)$/);
    if (!anchorMatch) {
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [],
        searchMethod: "anchor_parse_failed",
      };
    }

    const anchorId = anchorMatch[1];

    // セクション抽出用パターンをアンカーIDで具体化し、最初に一致した塊を採用
    const sectionPatterns = ANCHOR_SECTION_PATTERNS.map((p) => p(anchorId));
    let sectionContent = "";
    for (const pattern of sectionPatterns) {
      const match = html.match(pattern);
      if (match) {
        sectionContent = match[0];
        break;
      }
    }

    // パターンで拾えない場合は、周辺テキストをヒューリスティックに切り出し（±1000文字）
    if (!sectionContent) {
      for (const keyword of ANCHOR_SECTION_CONTACT_KEYWORDS) {
        const keywordIndex = html.toLowerCase().indexOf(keyword);
        if (keywordIndex !== -1) {
          const start = Math.max(0, keywordIndex - 1000);
          const end = Math.min(html.length, keywordIndex + 1000);
          sectionContent = html.substring(start, end);
          break;
        }
      }
    }

    // セクション内にHTMLフォームまたはGoogleフォームが存在するか検出
    if (sectionContent) {
      const hasForm = FormUtils.isValidContactForm(sectionContent);
      const googleForms = FormUtils.detectGoogleForms(sectionContent);
      if (hasForm || googleForms.found) {
        return {
          contactUrl: baseUrl,
          actualFormUrl: googleForms.found ? googleForms.url : baseUrl,
          foundKeywords: [
            "anchor_section_detected",
            hasForm ? "html_form_found" : "google_forms_found",
          ],
          searchMethod: "anchor_section_analysis",
        };
      }
    }

    // セクション抽出は成功/失敗いずれも、ここでの検出結果に従って返却
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: "anchor_section_insufficient",
    };
  } catch (error) {
    // 解析途中の例外は「エラー」として扱い、後続戦略の継続を優先
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: [],
      searchMethod: "anchor_section_error",
    };
  }
};

// ================================
// 2段階導線探索（関数型）
// -------------------------------
// 目的: 問い合わせページ内のリンクから、実フォーム（別ページ/別サービス）への導線を探索。
// 入力: html            - 問い合わせページHTML
//       contactPageUrl  - 現在の問い合わせページURL（相対→絶対解決の基準）
// 出力: string | null   - 実フォームURL（GoogleForm/同ページ埋め込み/2段階遷移先）
// 備考: 上位スコアの候補から最大3件を検証し、HTTP 200 で内容を確認する。
export const findSecondStageFormLink = (
  html: string,
  contactPageUrl: string,
): string | null => {
  const linkRegex = /<a[^>]*href=['"]([^'"\\]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
  const candidateLinks: Array<{ url: string; score: number }> = [];

  // aタグを走査し、フォームに繋がりやすいパターン/文言を加点して候補化
  for (let match = linkRegex.exec(html); match !== null; match = linkRegex.exec(html)) {
    const url = match[1];
    const linkText = match[2];
    if (!url || !linkText) continue;
    if (
      url.startsWith("mailto:") ||
      url.startsWith("javascript:") ||
      url.startsWith("tel:")
    )
      continue;

    const cleanLinkText = linkText
      .replace(/<[^>]*>/g, "")
      .trim()
      .toLowerCase();
    const lowerUrl = url.toLowerCase();
    let score = 0;

    // 明確な除外語（FAQ/製品紹介など）が含まれる候補はスキップ
    if (
      FORM_LINK_NEGATIVE_KEYWORDS.some(
        (keyword) =>
          lowerUrl.includes(keyword) || cleanLinkText.includes(keyword),
      )
    )
      continue;
    // ホーム（同一トップ）への戻りは導線として弱いので除外
    if (isHomepageUrl(contactPageUrl)(url)) continue;

    // URL/テキストのパターン一致でスコア加算（軽量ヒューリスティック）
    if (FORM_LINK_PATTERNS.some((pattern) => lowerUrl.includes(pattern)))
      score += 3;
    if (FORM_TEXT_PATTERNS.some((pattern) => cleanLinkText.includes(pattern)))
      score += 2;

    if (score > 0) {
      // 相対URLを絶対URLへ解決し、候補として保存
      candidateLinks.push({ url: resolveUrl(contactPageUrl)(url), score });
    }
  }

  // 候補ゼロなら導線なし
  if (candidateLinks.length === 0) return null;

  // スコア降順に並べ替え（よりフォームに繋がりやすい候補を優先）
  candidateLinks.sort((a, b) => b.score - a.score);

  // 上位3件のみ実体をフェッチして中身を確認（外部リンクのコストを抑制）
  for (const candidate of candidateLinks.slice(0, 3)) {
    try {
      const response = fetchUrl(candidate.url);
      if (response instanceof Error) {
        console.log(`Failed to fetch ${candidate.url}: ${response.message}`);
        continue; // エラーが発生した候補はスキップして次の候補へ
      }
      if (response.getResponseCode() === 200) {
        const candidateHtml = response.getContentText();

        // Googleフォーム直リンクを最優先で返す
        const hasGoogleForm = FormUtils.findGoogleFormUrlsOnly(candidateHtml);
        if (hasGoogleForm) return hasGoogleForm;

        // HTMLフォームが埋め込まれていれば、そのページURLを返す
        if (FormUtils.findEmbeddedHTMLForm(candidateHtml)) return candidate.url;

        // 明確なフォーム構造/ボリュームがあれば、そのページURLを返す
        if (FormUtils.hasSignificantFormContent(candidateHtml))
          return candidate.url;
      }
    } catch (error) {
      // 例外が起きた場合は、この候補をスキップして次の候補の検証に進む
      // （ここでは握りつぶし：上位候補の迅速な確認を優先）
    }
  }
  // 上位3件を検査しても決定打が無ければ導線なし
  return null;
};
