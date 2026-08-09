import { Injectable, Logger } from '@nestjs/common';
import { MailProvider, SendMailOptions } from './mail.provider';

@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  async sendMail(options: SendMailOptions): Promise<void> {
    this.logger.log(`
======== EMAIL SENT (CONSOLE MOCK) ========
To: ${options.to}
Subject: ${options.subject}
Body: ${options.body}
===========================================
    `);
  }
}
