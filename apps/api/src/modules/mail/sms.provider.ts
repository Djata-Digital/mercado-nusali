export interface SendSmsOptions {
  to: string;
  message: string;
}

export interface SmsProvider {
  sendSms(options: SendSmsOptions): Promise<void>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
