/**
 * SPA分析（完全移植版）
 * 最適版からの1バイトも変更しない完全移植
 */

import { NavigationSearcher } from '../navigation/NavigationSearcher';
import type { ContactPageResult } from '../../types/interfaces';

export class SPAAnalyzer {
  // SPA検出用HTMLキャッシュ
  private static sameHtmlCache: { [url: string]: string } = {};

  /**
   * 同一HTMLパターン検出（最適版完全移植）
   */
  static detectSameHtmlPattern(urls: string[], htmlContent: string): boolean {
    const contentHash = this.hashString(htmlContent);
    let sameCount = 0;
    
    for (const url of urls) {
      if (this.sameHtmlCache[url] === contentHash) {
        sameCount++;
      } else {
        this.sameHtmlCache[url] = contentHash;
      }
    }
    
    // If 2 or more URLs return the same HTML, likely SPA
    return sameCount >= 2;
  }

  /**
   * 文字列ハッシュ計算（最適版完全移植）
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * SPA分析実行（最適版完全移植）
   */
  static executeSPAAnalysis(html: string, baseUrl: string): ContactPageResult {
    try {
      console.log('Executing SPA analysis on detected single-page application');
      
      // Navigation search for anchor links in the current HTML
      const navResult = NavigationSearcher.searchInNavigation(html, baseUrl);
      if (navResult.url && this.isAnchorLink(navResult.url)) {
        console.log(`Anchor link found in SPA navigation: ${navResult.url}`);
        
        // Analyze the corresponding section in the same HTML
        const anchorSectionResult = this.analyzeAnchorSection(html, navResult.url, baseUrl);
        if (anchorSectionResult.contactUrl) {
          // Update search method to reflect SPA detection
          anchorSectionResult.searchMethod = 'spa_anchor_analysis';
          anchorSectionResult.foundKeywords.push('spa_detected');
          return anchorSectionResult;
        }
      }

      // No anchor contact links found in SPA
      console.log('SPA analysis completed but no suitable anchor contact found');
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['spa_detected', 'anchor_analysis_failed'],
        searchMethod: 'spa_analysis_failed'
      };
    } catch (error) {
      console.log(`Error in SPA analysis: ${error}`);
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['spa_detected', 'spa_analysis_error'],
        searchMethod: 'spa_analysis_error'
      };
    }
  }

  /**
   * アンカーリンク判定（最適版完全移植）
   */
  static isAnchorLink(url: string): boolean {
    return url.includes('#');
  }

  /**
   * アンカーセクション分析（最適版完全移植）
   */
  static analyzeAnchorSection(html: string, anchorUrl: string, baseUrl: string): ContactPageResult {
    try {
      // Extract anchor name from URL (e.g., "#contact" -> "contact")
      const anchorMatch = anchorUrl.match(/#(.+)$/);
      if (!anchorMatch) {
        console.log('No anchor fragment found in URL');
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: ['anchor_parse_failed'],
          searchMethod: 'anchor_analysis_failed'
        };
      }

      const anchorName = anchorMatch[1];
      console.log(`Analyzing anchor section: ${anchorName}`);

      // Look for the corresponding section with id matching the anchor
      const sectionRegex = new RegExp(`<[^>]*id=['"]${anchorName}['"][^>]*[\\s\\S]*?(?=<[^>]*id=['"]|$)`, 'i');
      const sectionMatch = html.match(sectionRegex);

      if (sectionMatch && sectionMatch[0]) {
        const sectionContent = sectionMatch[0];
        console.log(`Found anchor section with ${sectionContent.length} characters`);

        // Check if section contains contact info
        const contactInfo = this.extractContactInfo(sectionContent);
        console.log(`Contact analysis: phone=${contactInfo.phone}, email=${contactInfo.email}, form=${contactInfo.contactForm}`);

        if (contactInfo.phone || contactInfo.email || contactInfo.contactForm) {
          // Found contact information in the anchor section
          console.log(`✅ Contact info confirmed in anchor section: ${anchorName}`);
          
          return {
            contactUrl: anchorUrl,
            actualFormUrl: anchorUrl,
            foundKeywords: [`anchor_${anchorName}`, 'contact_section_confirmed'],
            searchMethod: 'spa_anchor_contact'
          };
        } else {
          console.log(`❌ No contact info found in anchor section: ${anchorName}`);
        }
      } else {
        console.log(`❌ No matching section found for anchor: ${anchorName}`);
      }

      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: [`anchor_${anchorName}`, 'no_contact_info'],
        searchMethod: 'anchor_analysis_failed'
      };

    } catch (error) {
      console.log(`Error analyzing anchor section: ${error}`);
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['anchor_analysis_error'],
        searchMethod: 'anchor_analysis_error'
      };
    }
  }

  /**
   * 問い合わせ情報抽出（最適版完全移植）
   */
  static extractContactInfo(html: string): { phone: boolean, email: boolean, contactForm: boolean } {
    console.log('Extracting contact info from HTML section');
    
    let phone = false;
    let email = false;
    let contactForm = false;

    // Phone number patterns (Japanese format)
    const phonePatterns = [
      /\d{2,4}[-\s]\d{2,4}[-\s]\d{3,4}/,  // 03-1234-5678, 090 1234 5678
      /\d{10,11}/,                        // 09012345678
      /Tel[:：]\s*\d/i,                   // Tel: 03-1234-5678
      /電話[:：]\s*\d/,                    // 電話：03-1234-5678
      /TEL[:：]\s*\d/i,                   // TEL：03-1234-5678
      /\(\d{2,4}\)\s*\d{3,4}[-\s]\d{3,4}/ // (03) 1234-5678
    ];

    // Email patterns
    const emailPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      /mailto:/i,
      /E-mail[:：]/i,
      /メール[:：]/i
    ];

    // Contact form patterns
    const formPatterns = [
      /<form[^>]*>/i,
      /<input[^>]*type=['"]email['"][^>]*>/i,
      /<input[^>]*type=['"]tel['"][^>]*>/i,
      /<textarea[^>]*>/i,
      /お問い合わせフォーム/i,
      /問い合わせフォーム/i,
      /contact\s+form/i
    ];

    // Test phone patterns
    for (const pattern of phonePatterns) {
      if (pattern.test(html)) {
        phone = true;
        console.log('Phone number pattern detected');
        break;
      }
    }

    // Test email patterns
    for (const pattern of emailPatterns) {
      if (pattern.test(html)) {
        email = true;
        console.log('Email pattern detected');
        break;
      }
    }

    // Test contact form patterns
    for (const pattern of formPatterns) {
      if (pattern.test(html)) {
        contactForm = true;
        console.log('Contact form pattern detected');
        break;
      }
    }

    return { phone, email, contactForm };
  }
}