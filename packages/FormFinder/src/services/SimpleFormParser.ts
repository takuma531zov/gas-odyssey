import { FormStructure, FormField } from '../types';
import { Logger } from '../utils/logger';
import { FORM_PARSING_REGEX } from '../utils/constants';

/**
 * SimpleFormParser - シンプルな送信要素検出ベースのフォームパーサー
 * 
 * 設計方針:
 * - formタグ内のHTML構造を解析
 * - 送信要素（submit button/input）の存在でContact formと判定  
 * - 複数フォームから送信要素を持つものを優先選択
 * - 複雑なスコアリングや戦略パターンを排除
 * - GoogleフォームやHTMLフォームを統一的に処理
 */
export class SimpleFormParser {

  // =====================================================
  // パブリックメソッド - フォーム解析エントリポイント
  // =====================================================

  /**
   * HTMLから送信要素を持つフォーム構造を抽出（複数フォーム対応）
   */
  parseFormStructure(html: string, baseUrl: string): FormStructure | null {
    Logger.debug(`フォーム解析開始: ${baseUrl}`);
    
    if (!html || !baseUrl) {
      Logger.warn('HTML または baseUrl が空のため、フォーム解析をスキップ');
      return null;
    }

    try {
      // 全フォーム要素を抽出
      const allFormHtmls = this.extractAllFormHtmls(html);
      
      if (allFormHtmls.length === 0) {
        Logger.debug('フォーム要素が見つかりませんでした');
        return null;
      }

      Logger.debug(`${allFormHtmls.length}個のフォーム要素を検出`);

      // 送信要素を持つフォームを優先的に検索
      for (let i = 0; i < allFormHtmls.length; i++) {
        const formHtml = allFormHtmls[i];
        if (!formHtml) continue;

        // 送信要素の存在チェック
        const hasSubmit = this.hasSubmitElement(formHtml);
        Logger.debug(`フォーム${i + 1}: 送信要素${hasSubmit ? 'あり' : 'なし'}`);

        if (hasSubmit) {
          // 送信要素があるフォームを構造化
          const formStructure = this.buildFormStructure(formHtml, baseUrl);
          
          if (formStructure) {
            Logger.info(`送信要素を持つフォーム発見（${i + 1}番目）: ${formStructure.fields.length}個のフィールド`);
            return formStructure;
          }
        }
      }

      // 送信要素を持つフォームがない場合は最初のフォームを返す（後方互換性）
      Logger.debug('送信要素を持つフォームが見つからないため、最初のフォームを使用');
      const firstFormStructure = this.buildFormStructure(allFormHtmls[0]!, baseUrl);
      
      if (firstFormStructure) {
        Logger.debug(`最初のフォーム使用: ${firstFormStructure.fields.length}個のフィールド`);
      }
      
      return firstFormStructure;
    } catch (error) {
      Logger.error('フォーム解析中にエラーが発生', error);
      return null;
    }
  }

  /**
   * Contact form判定 - 送信要素の存在をチェック
   */
  isContactRelatedForm(html: string, formStructure: FormStructure, _formUrl: string): boolean {
    Logger.debug('送信要素による Contact form 判定開始');

    try {
      // 既に送信要素を持つフォームが選択されている場合
      // parseFormStructure()で送信要素チェック済みのため、基本的にtrueを返す
      
      // 念のため、フォーム内のHTML構造から送信要素を再検証
      const allFormHtmls = this.extractAllFormHtmls(html);
      
      if (allFormHtmls.length === 0) {
        Logger.debug('フォーム要素が見つからないため false');
        return false;
      }

      // 渡されたformStructureに対応するフォームHTMLを検索し、送信要素をチェック
      for (const formHtml of allFormHtmls) {
        if (!formHtml) continue;

        // このフォームが渡されたformStructureと一致するかチェック
        const currentFormStructure = this.buildFormStructure(formHtml, formStructure.formAction);
        
        if (currentFormStructure && 
            currentFormStructure.formAction === formStructure.formAction &&
            currentFormStructure.fields.length === formStructure.fields.length) {
          // 送信要素の存在チェック
          const hasSubmit = this.hasSubmitElement(formHtml);
          Logger.debug(`対応フォーム発見、送信要素検出結果: ${hasSubmit ? 'あり' : 'なし'}`);
          return hasSubmit;
        }
      }

      // フォームが見つからない場合はfalse
      Logger.debug('対応するフォームが見つからないため false');
      return false;
    } catch (error) {
      Logger.error('Contact form 判定中にエラーが発生', error);
      return false;
    }
  }

  // =====================================================
  // プライベートメソッド - HTML解析処理
  // =====================================================

  /**
   * HTMLから全てのフォームHTML要素を抽出
   */
  private extractAllFormHtmls(html: string): string[] {
    // 事前コンパイル済み正規表現を使用（パフォーマンス向上）
    const formMatches = html.match(FORM_PARSING_REGEX.FORM_ELEMENT) || [];
    Logger.debug(`${formMatches.length}個のフォーム要素を検出`);
    return formMatches;
  }

  /**
   * フォームHTML内の送信要素存在チェック
   */
  private hasSubmitElement(formHtml: string): boolean {
    // 送信要素の検出パターン
    const submitPatterns = [
      // input type="submit"
      /<input[^>]*type\s*=\s*["']submit["'][^>]*>/i,
      
      // button type="submit" (明示的)
      /<button[^>]*type\s*=\s*["']submit["'][^>]*>/i,
      
      // button要素（type未指定はデフォルトでsubmit）
      /<button(?![^>]*type\s*=\s*["'](?:button|reset)["'])[^>]*>/i
    ];

    // いずれかのパターンにマッチすれば送信要素あり
    for (const pattern of submitPatterns) {
      if (pattern.test(formHtml)) {
        Logger.debug(`送信要素検出: ${pattern.source}`);
        return true;
      }
    }

    Logger.debug('送信要素は検出されませんでした');
    return false;
  }

  /**
   * フォームHTMLからFormStructureオブジェクトを構築
   */
  private buildFormStructure(formHtml: string, baseUrl: string): FormStructure | null {
    try {
      const formStructure: FormStructure = {
        // action属性を抽出して絶対URLに変換
        formAction: this.extractFormAction(formHtml, baseUrl),
        
        // method属性を抽出
        method: this.extractFormMethod(formHtml),
        
        // フォーム内のフィールドを抽出
        fields: this.extractFormFields(formHtml),
        
        // 送信ボタンのテキストを抽出
        submitButton: this.extractSubmitButtonText(formHtml)
      };

      // 最低限のバリデーション
      if (formStructure.fields.length === 0) {
        Logger.debug('フィールドが存在しないフォームのためスキップ');
        return null;
      }

      return formStructure;
    } catch (error) {
      Logger.error('FormStructure構築中にエラーが発生', error);
      return null;
    }
  }

  /**
   * action属性を抽出して絶対URLに変換
   */
  private extractFormAction(formHtml: string, baseUrl: string): string {
    // 事前コンパイル済み正規表現を使用
    const actionMatch = formHtml.match(FORM_PARSING_REGEX.ACTION_ATTR);
    
    if (!actionMatch || !actionMatch[1]) {
      return baseUrl; // action属性がない場合は現在のURLを使用
    }

    const action = actionMatch[1];
    
    // 絶対URLの場合はそのまま返す
    if (action.startsWith('http://') || action.startsWith('https://')) {
      return action;
    } 
    
    // 相対URLの場合は絶対URLに変換
    if (action.startsWith('/')) {
      // ルート相対パス: ドメイン部分を抽出
      const domain = baseUrl.match(/^https?:\/\/[^\/]+/)?.[0] || baseUrl;
      return `${domain}${action}`;
    } else {
      // 相対パス: 現在のディレクトリに追加
      const basePath = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      return `${basePath}${action}`;
    }
  }

  /**
   * method属性を抽出
   */
  private extractFormMethod(formHtml: string): 'POST' | 'GET' {
    // 事前コンパイル済み正規表現を使用
    const methodMatch = formHtml.match(FORM_PARSING_REGEX.METHOD_ATTR);
    
    if (methodMatch && methodMatch[1]) {
      return methodMatch[1].toUpperCase() === 'GET' ? 'GET' : 'POST';
    }
    
    return 'POST'; // デフォルトはPOST
  }

  /**
   * フォーム内の全フィールドを抽出
   */
  private extractFormFields(formHtml: string): FormField[] {
    const fields: FormField[] = [];

    // input要素を抽出
    const inputMatches = formHtml.match(FORM_PARSING_REGEX.INPUT_ELEMENT) || [];
    for (const inputHtml of inputMatches) {
      const field = this.parseInputElement(inputHtml);
      if (field && this.shouldIncludeField(field)) {
        fields.push(field);
      }
    }

    // textarea要素を抽出
    const textareaMatches = formHtml.match(FORM_PARSING_REGEX.TEXTAREA_ELEMENT) || [];
    for (const textareaHtml of textareaMatches) {
      const field = this.parseTextareaElement(textareaHtml);
      if (field) {
        fields.push(field);
      }
    }

    // select要素を抽出
    const selectMatches = formHtml.match(FORM_PARSING_REGEX.SELECT_ELEMENT) || [];
    for (const selectHtml of selectMatches) {
      const field = this.parseSelectElement(selectHtml);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  /**
   * input要素を解析してFormFieldオブジェクトを作成
   */
  private parseInputElement(inputHtml: string): FormField | null {
    const nameMatch = inputHtml.match(FORM_PARSING_REGEX.NAME_ATTR);
    const typeMatch = inputHtml.match(FORM_PARSING_REGEX.TYPE_ATTR);
    const idMatch = inputHtml.match(FORM_PARSING_REGEX.ID_ATTR);
    const requiredMatch = inputHtml.match(FORM_PARSING_REGEX.REQUIRED_ATTR);

    if (!nameMatch || !nameMatch[1]) {
      return null; // name属性がない場合はスキップ
    }

    return {
      name: nameMatch[1]!,
      type: typeMatch ? typeMatch[1]! : 'text',
      id: idMatch?.[1],
      required: !!requiredMatch,
      label: undefined // シンプル実装のためラベル抽出は省略
    };
  }

  /**
   * textarea要素を解析してFormFieldオブジェクトを作成
   */
  private parseTextareaElement(textareaHtml: string): FormField | null {
    const nameMatch = textareaHtml.match(FORM_PARSING_REGEX.NAME_ATTR);
    const idMatch = textareaHtml.match(FORM_PARSING_REGEX.ID_ATTR);
    const requiredMatch = textareaHtml.match(FORM_PARSING_REGEX.REQUIRED_ATTR);

    if (!nameMatch || !nameMatch[1]) {
      return null; // name属性がない場合はスキップ
    }

    return {
      name: nameMatch[1]!,
      type: 'textarea',
      id: idMatch?.[1],
      required: !!requiredMatch,
      label: undefined // シンプル実装のためラベル抽出は省略
    };
  }

  /**
   * select要素を解析してFormFieldオブジェクトを作成
   */
  private parseSelectElement(selectHtml: string): FormField | null {
    const nameMatch = selectHtml.match(FORM_PARSING_REGEX.NAME_ATTR);
    const idMatch = selectHtml.match(FORM_PARSING_REGEX.ID_ATTR);
    const requiredMatch = selectHtml.match(FORM_PARSING_REGEX.REQUIRED_ATTR);

    if (!nameMatch || !nameMatch[1]) {
      return null; // name属性がない場合はスキップ
    }

    return {
      name: nameMatch[1]!,
      type: 'select',
      id: idMatch?.[1],
      required: !!requiredMatch,
      label: undefined // シンプル実装のためラベル抽出は省略
    };
  }

  /**
   * フィールドを結果に含めるかどうかを判定
   */
  private shouldIncludeField(field: FormField): boolean {
    // 除外すべきフィールドタイプ
    const excludeTypes = ['hidden', 'submit', 'button', 'reset', 'image'];
    return !excludeTypes.includes(field.type.toLowerCase());
  }

  /**
   * 送信ボタンのテキストを抽出
   */
  private extractSubmitButtonText(formHtml: string): string | undefined {
    // 事前コンパイル済み正規表現を使用
    for (const pattern of FORM_PARSING_REGEX.SUBMIT_BUTTONS) {
      const match = formHtml.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }
}