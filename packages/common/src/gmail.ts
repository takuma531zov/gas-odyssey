export type MailObjType = {
  subject: string;
  email: string;
  body: string;
};

/**
 * Gmailの下書きを作成する
 * @param mailObj
 */
export const createGmailDraft = (mailObj: MailObjType) => {
  GmailApp.createDraft(mailObj.email, mailObj.subject, mailObj.body);
};
