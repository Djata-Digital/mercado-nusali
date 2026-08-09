import { Injectable, Inject } from '@nestjs/common';
import { MAIL_PROVIDER, MailProvider, SendMailOptions } from './mail.provider';
import { SMS_PROVIDER, SmsProvider, SendSmsOptions } from './sms.provider';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.mailProvider.sendMail(options);
  }

  async sendSms(options: SendSmsOptions): Promise<void> {
    await this.smsProvider.sendSms(options);
  }

  async sendVerificationEmail(to: string, code: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Mercado Nusali - Verificação de E-mail',
      body: `Seu código de verificação para o Mercado Nusali é: ${code}`,
      html: `<p>Seu código de verificação para o Mercado Nusali é: <strong>${code}</strong></p>`,
    });
  }

  async sendVerificationSms(to: string, code: string): Promise<void> {
    await this.sendSms({
      to,
      message: `Mercado Nusali: Seu código de verificação por SMS é: ${code}`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Mercado Nusali - Redefinição de Senha',
      body: `Use o token a seguir para redefinir sua senha: ${token}`,
      html: `<p>Use o token a seguir para redefinir sua senha: <strong>${token}</strong></p>`,
    });
  }
}
