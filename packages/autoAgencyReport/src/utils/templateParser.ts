import type { TemplateVariables } from "../types";
import { TEMPLATE_VARIABLES } from "../config/constants";

/**
 * テンプレート文字列内の変数を実際の値で置換
 * @param template テンプレート文字列（例: "{{会社名}}様 {{担当者}}さん"）
 * @param variables 置換する変数の値
 * @returns 置換後の文字列
 */
export const parseTemplate = (
  template: string,
  variables: TemplateVariables,
): string => {
  let result = template;

  // 会社名を置換
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.COMPANY_NAME, "g"),
    variables.companyName,
  );

  // 担当者名を置換（存在する場合のみ）
  if (variables.personInCharge) {
    result = result.replace(
      new RegExp(TEMPLATE_VARIABLES.PERSON_IN_CHARGE, "g"),
      variables.personInCharge,
    );
  } else {
    // 担当者名が存在しない場合は変数部分を削除
    result = result.replace(
      new RegExp(TEMPLATE_VARIABLES.PERSON_IN_CHARGE, "g"),
      "",
    );
  }

  return result;
};
