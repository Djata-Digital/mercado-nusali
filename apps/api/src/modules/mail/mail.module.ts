import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MAIL_PROVIDER } from './mail.provider';
import { ResendMailProvider } from './resend-mail.provider';
import { SMS_PROVIDER } from './sms.provider';
import { ConsoleSmsProvider } from './console-sms.provider';

@Global()
@Module({
  providers: [
    MailService,
    {
      provide: MAIL_PROVIDER,
      useClass: ResendMailProvider,
    },
    {
      provide: SMS_PROVIDER,
      useClass: ConsoleSmsProvider,
    },
  ],
  exports: [MailService],
})
export class MailModule {}