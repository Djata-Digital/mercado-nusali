import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SendSmsOptions } from './sms.provider';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async sendSms(options: SendSmsOptions): Promise<void> {
    this.logger.log(`
======== SMS SENT (CONSOLE MOCK) ========
To: ${options.to}
Message: ${options.message}
=========================================
    `);
  }
}
