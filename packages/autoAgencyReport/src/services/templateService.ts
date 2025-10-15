import { getSheet } from "../../../common/src/spreadsheet";
import type { Template, TemplateVariables, Agency } from "../types";
import { parseTemplate } from "../utils/templateParser";

/**
 * テンプレートシートからテンプレート情報を取得
 * @param templateName テンプレート名（シート名）
 * @returns テンプレート情報
 */
export const getTemplate = (templateName: string): Template => {
  const templateSheet = getSheet(templateName);

  if (!templateSheet) {
    throw new Error(`テンプレートシート "${templateName}" が見つかりません`);
  }

  // A1セル: 件名
  const subject = templateSheet.getRange(1, 1).getValue() as string;

  // A2セル: 本文
  const body = templateSheet.getRange(2, 1).getValue() as string;

  return {
    subject,
    body,
  };
};

/**
 * テンプレートを代理店情報で置換したメッセージを生成
 * @param template テンプレート
 * @param agency 代理店情報
 * @returns 置換後のメッセージ
 */
export const generateMessage = (
  template: Template,
  agency: Agency,
): { subject: string; body: string } => {
  const variables: TemplateVariables = {
    companyName: agency.companyName,
    personInCharge: agency.personInCharge,
  };

  return {
    subject: parseTemplate(template.subject, variables),
    body: parseTemplate(template.body, variables),
  };
};
