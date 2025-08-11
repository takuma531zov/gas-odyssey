/**
 * HTML処理ユーティリティ
 * HTML解析とテキスト処理を管理
 */

export class HtmlUtils {
  
  /**
   * 文字列をHEX形式で表示（文字化けデバッグ用）
   * @param str 対象文字列
   * @returns HEX形式文字列
   */
  static toHexString(str: string): string {
    try {
      return Array.from(str).map(char => 
        char.charCodeAt(0).toString(16).padStart(2, '0')
      ).join(' ');
    } catch (error) {
      return `[HEX conversion error: ${error}]`;
    }
  }

  /**
   * HTMLからテキストコンテンツを抽出（タグ除去）
   * @param html HTML文字列
   * @returns プレーンテキスト
   */
  static stripHtmlTags(html: string): string {
    if (!html) return '';
    
    // Remove script and style tags completely
    let cleaned = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * HTMLからリンクを抽出
   * @param html HTML文字列
   * @returns リンク配列（{href, text}形式）
   */
  static extractLinks(html: string): Array<{href: string, text: string}> {
    const links: Array<{href: string, text: string}> = [];
    const linkRegex = /<a[^>]*href=['"]([^'\"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = this.stripHtmlTags(match[2]).trim();
      
      if (href && text) {
        links.push({ href, text });
      }
    }

    return links;
  }

  /**
   * HTMLから指定セレクタのコンテンツを抽出
   * @param html HTML文字列
   * @param selectors セレクタ配列（正規表現）
   * @returns マッチしたコンテンツ配列
   */
  static extractBySelectors(html: string, selectors: RegExp[]): string[] {
    const matches: string[] = [];
    
    for (const selector of selectors) {
      const found = html.match(selector) || [];
      matches.push(...found);
    }
    
    return matches;
  }

  /**
   * HTMLの文字エンコーディングを検出
   * @param html HTML文字列
   * @returns 検出されたエンコーディング（見つからない場合はUTF-8）
   */
  static detectEncoding(html: string): string {
    // Check meta charset
    const charsetMatch = html.match(/<meta[^>]*charset=['"]?([^'"\s>]+)/i);
    if (charsetMatch) {
      return charsetMatch[1].toLowerCase();
    }

    // Check HTTP-equiv content-type
    const contentTypeMatch = html.match(/<meta[^>]*http-equiv=['"]?content-type['"]?[^>]*content=['"]?[^'"]*charset=([^'"\s;]+)/i);
    if (contentTypeMatch) {
      return contentTypeMatch[1].toLowerCase();
    }

    return 'utf-8'; // Default
  }

  /**
   * HTMLからフォーム要素を抽出
   * @param html HTML文字列
   * @returns フォーム要素の情報
   */
  static extractForms(html: string): Array<{
    action?: string,
    method?: string,
    inputs: Array<{type: string, name?: string, value?: string}>
  }> {
    const forms: Array<{
      action?: string,
      method?: string,
      inputs: Array<{type: string, name?: string, value?: string}>
    }> = [];

    // Extract form tags
    const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
    let formMatch;

    while ((formMatch = formRegex.exec(html)) !== null) {
      const formTag = formMatch[0];
      const formContent = formMatch[1];

      // Extract form attributes
      const actionMatch = formTag.match(/action=['"]?([^'"\s>]+)/i);
      const methodMatch = formTag.match(/method=['"]?([^'"\s>]+)/i);

      // Extract input elements
      const inputs: Array<{type: string, name?: string, value?: string}> = [];
      const inputRegex = /<input[^>]*>/gi;
      let inputMatch;

      while ((inputMatch = inputRegex.exec(formContent)) !== null) {
        const inputTag = inputMatch[0];
        const typeMatch = inputTag.match(/type=['"]?([^'"\s>]+)/i);
        const nameMatch = inputTag.match(/name=['"]?([^'"\s>]+)/i);
        const valueMatch = inputTag.match(/value=['"]?([^'"]*)/i);

        inputs.push({
          type: typeMatch ? typeMatch[1] : 'text',
          name: nameMatch ? nameMatch[1] : undefined,
          value: valueMatch ? valueMatch[1] : undefined
        });
      }

      forms.push({
        action: actionMatch ? actionMatch[1] : undefined,
        method: methodMatch ? methodMatch[1] : 'get',
        inputs
      });
    }

    return forms;
  }

  /**
   * HTML文字列の基本的なサニタイゼーション
   * @param html HTML文字列
   * @returns サニタイズされたHTML
   */
  static sanitizeHtml(html: string): string {
    if (!html) return '';
    
    // Remove dangerous elements
    const dangerous = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /<style[^>]*>[\s\S]*?<\/style>/gi,
      /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
      /<object[^>]*>[\s\S]*?<\/object>/gi,
      /<embed[^>]*>/gi,
      /<link[^>]*>/gi
    ];

    let sanitized = html;
    for (const regex of dangerous) {
      sanitized = sanitized.replace(regex, '');
    }

    return sanitized;
  }
}