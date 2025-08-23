import { Environment } from '../env';
import { NetworkUtils } from '../utils/NetworkUtils';
import { HtmlAnalyzer } from '../analyzers/HtmlAnalyzer';
import { CandidateManager } from '../core/CandidateManager';
import { PatternSearcher } from '../core/PatternSearcher';

/**
 * 単一のURLをテストするための関数
 * GASエディタから直接実行して使用
 */
export function test(): void {
  const testUrl = 'https://www.icube-inc.co.jp/'; // テストしたいURLをここに設定
  console.log(`--- Running test for: ${testUrl} ---`);
  
  // ContactPageFinder.findContactPageの処理を直接実行
  const startTime = Date.now();
  const maxTotalTime = Environment.getMaxTotalTime();

  try {
    // 候補リストのリセット（新しい検索開始時）
    CandidateManager.resetCandidates();

    // SNSページの検出
    if (NetworkUtils.isSNSPage(testUrl)) {
      console.log(`SNS page detected: ${testUrl}, returning not found`);
      console.log('Result: null');
      return;
    }

    // ドメイン生存確認
    console.log(`Checking domain availability for: ${testUrl}`);
    const domainCheck = NetworkUtils.checkDomainAvailability(testUrl);
    if (!domainCheck.available) {
      console.log(`Domain unavailable: ${domainCheck.error}`);
      console.log('Result: null');
      return;
    }
    console.log(`Domain is available, proceeding with contact search`);

    // Extract domain for subdirectory pattern support
    const domainUrl = NetworkUtils.extractDomain(testUrl);

    console.log(`Starting contact page search for: ${testUrl}`);

    // STEP 1: URL pattern guessing with integrated SPA detection
    console.log('Step 1: URL pattern guessing with SPA optimization (primary strategy)');
    const priorityResult = PatternSearcher.searchWithPriorityPatterns(domainUrl, startTime);
    if (priorityResult.contactUrl) {
      console.log(`✅ Found via URL pattern search: ${priorityResult.contactUrl}`);
      console.log('--- Test Result ---');
      console.log(`Contact URL: ${priorityResult.contactUrl}`);
      console.log(`Actual Form URL: ${priorityResult.actualFormUrl}`);
      console.log(`Search Method: ${priorityResult.searchMethod}`);
      console.log(`Keywords: ${priorityResult.foundKeywords.join(', ')}`);
      console.log('-------------------');
      return;
    }

    // エラーの場合は即座に返す（fallback処理をスキップ）
    if (priorityResult.searchMethod === 'dns_error' || priorityResult.searchMethod === 'bot_blocked') {
      console.log(`URL pattern search returned error: ${priorityResult.searchMethod}, stopping here`);
      console.log('--- Test Result ---');
      console.log(`Contact URL: ${priorityResult.contactUrl}`);
      console.log(`Actual Form URL: ${priorityResult.actualFormUrl}`);
      console.log(`Search Method: ${priorityResult.searchMethod}`);
      console.log(`Keywords: ${priorityResult.foundKeywords.join(', ')}`);
      console.log('-------------------');
      return;
    }

    // Check remaining time
    if (Date.now() - startTime > maxTotalTime) {
      console.log('Timeout reached during URL pattern search');
      console.log('Result: timeout');
      return;
    }

    // STEP 2: Homepage HTML analysis
    console.log('Step 2: Homepage HTML analysis as fallback for special cases');
    try {
      const response = NetworkUtils.fetchWithTimeout(testUrl, 7000);
      const html = NetworkUtils.getContentWithEncoding(response);

      // Check for Google Forms URLs first
      const googleFormUrls = NetworkUtils.findGoogleFormUrlsOnly(html);
      if (googleFormUrls) {
        console.log(`✅ Found Google Form URL on homepage: ${googleFormUrls}`);
        const result = {
          contactUrl: testUrl,
          actualFormUrl: googleFormUrls,
          foundKeywords: ['homepage_google_form'],
          searchMethod: 'homepage_google_form_fallback'
        };
        console.log('--- Test Result ---');
        console.log(`Contact URL: ${result.contactUrl}`);
        console.log(`Actual Form URL: ${result.actualFormUrl}`);
        console.log(`Search Method: ${result.searchMethod}`);
        console.log(`Keywords: ${result.foundKeywords.join(', ')}`);
        console.log('-------------------');
        return;
      }

      // Analyze HTML content for contact links
      const result = HtmlAnalyzer.analyzeHtmlContent(html, testUrl);

      // If we found a contact page, try to find the actual form within it
      if (result.contactUrl) {
        console.log(`Found contact link on homepage: ${result.contactUrl}`);
        const formUrl = HtmlAnalyzer.findActualForm(result.contactUrl);
        result.actualFormUrl = formUrl;
        result.searchMethod = 'homepage_link_fallback';

        console.log('--- Test Result ---');
        console.log(`Contact URL: ${result.contactUrl}`);
        console.log(`Actual Form URL: ${result.actualFormUrl}`);
        console.log(`Search Method: ${result.searchMethod}`);
        console.log(`Keywords: ${result.foundKeywords.join(', ')}`);
        console.log('-------------------');
        return;
      }

      // Check for embedded forms as last resort
      const embeddedFormResult = NetworkUtils.findEmbeddedHTMLForm(html);
      if (embeddedFormResult) {
        console.log(`✅ Found embedded form on homepage as last resort`);
        const result = {
          contactUrl: testUrl,
          actualFormUrl: testUrl,
          foundKeywords: ['homepage_embedded_form'],
          searchMethod: 'homepage_embedded_fallback'
        };
        console.log('--- Test Result ---');
        console.log(`Contact URL: ${result.contactUrl}`);
        console.log(`Actual Form URL: ${result.actualFormUrl}`);
        console.log(`Search Method: ${result.searchMethod}`);
        console.log(`Keywords: ${result.foundKeywords.join(', ')}`);
        console.log('-------------------');
        return;
      }

      console.log('HTML analysis fallback found nothing');

    } catch (homepageError) {
      const detailedError = NetworkUtils.getDetailedNetworkError(homepageError);
      console.log(`Error in homepage analysis fallback: ${detailedError}`);
    }

    // FINAL FALLBACK: Return first valid contact URL from Step1 if available
    console.log('All search methods failed, checking final fallback...');
    const fallbackResult = CandidateManager.getFinalFallbackUrl();
    if (fallbackResult.contactUrl) {
      console.log(`✅ Final fallback successful: ${fallbackResult.contactUrl}`);
      console.log('--- Test Result ---');
      console.log(`Contact URL: ${fallbackResult.contactUrl}`);
      console.log(`Actual Form URL: ${fallbackResult.actualFormUrl}`);
      console.log(`Search Method: ${fallbackResult.searchMethod}`);
      console.log(`Keywords: ${fallbackResult.foundKeywords.join(', ')}`);
      console.log('-------------------');
      return;
    }

    console.log('All search methods failed, including final fallback');
    console.log('--- Test Result ---');
    console.log('Contact URL: null');
    console.log('Actual Form URL: null');
    console.log('Search Method: not_found');
    console.log('Keywords: []');
    console.log('-------------------');
  } catch (error) {
    const detailedError = NetworkUtils.getDetailedNetworkError(error);
    console.error(`Error fetching ${testUrl}: ${detailedError}`);
    console.log('--- Test Result ---');
    console.log('Contact URL: null');
    console.log('Actual Form URL: null');
    console.log('Search Method: error');
    console.log(`Keywords: ${detailedError}`);
    console.log('-------------------');
  }
}