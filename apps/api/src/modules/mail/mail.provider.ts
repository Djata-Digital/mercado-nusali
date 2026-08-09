export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface MailProvider {
  sendMail(options: SendMailOptions): Promise<void>;
}

export const MAIL_PROVIDER = 'MAIL_PROVIDER';
