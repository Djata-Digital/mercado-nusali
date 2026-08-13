import { Injectable, Inject } from '@nestjs/common';
import {
  MAIL_PROVIDER,
  MailProvider,
  SendMailOptions,
} from './mail.provider';
import {
  SMS_PROVIDER,
  SmsProvider,
  SendSmsOptions,
} from './sms.provider';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,

    @Inject(SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
  ) {}

  async sendMail(
    options: SendMailOptions,
  ): Promise<void> {
    await this.mailProvider.sendMail(options);
  }

  async sendSms(
    options: SendSmsOptions,
  ): Promise<void> {
    await this.smsProvider.sendSms(options);
  }

  async sendVerificationEmail(
    to: string,
    code: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject:
        'Mercado Nusali - Verificação de E-mail',
      body:
        `Seu código de verificação para o Mercado Nusali é: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color:#047857;">Mercado Nusali</h2>
          <p>Use o código abaixo para verificar seu e-mail:</p>
          <div style="
            font-size:28px;
            font-weight:700;
            letter-spacing:6px;
            padding:16px;
            background:#f0fdf4;
            border-radius:10px;
            text-align:center;
            color:#065f46;
          ">
            ${code}
          </div>
          <p style="color:#64748b;font-size:13px;">
            Se você não solicitou este código, ignore esta mensagem.
          </p>
        </div>
      `,
    });
  }

  async sendVerificationSms(
    to: string,
    code: string,
  ): Promise<void> {
    await this.sendSms({
      to,
      message:
        `Mercado Nusali: Seu código de verificação por SMS é: ${code}`,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject:
        'Mercado Nusali - Redefinição de Senha',
      body:
        `Use o token a seguir para redefinir sua senha: ${token}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#047857;">Mercado Nusali</h2>
          <p>Use o token abaixo para redefinir sua senha:</p>
          <p><strong>${token}</strong></p>
        </div>
      `,
    });
  }

  async sendStoreInvitationEmail(data: {
    to: string;
    storeName: string;
    inviterName?: string;
    roleLabel: string;
    invitationUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    const expiresFormatted =
      data.expiresAt.toLocaleString(
        'pt-BR',
        {
          dateStyle: 'long',
          timeStyle: 'short',
        },
      );

    await this.sendMail({
      to: data.to,

      subject:
        `Convite para integrar a equipe da loja ${data.storeName} - Mercado Nusali`,

      body: [
        'Você recebeu um convite para integrar uma equipe no Mercado Nusali.',
        `Loja: ${data.storeName}`,
        `Cargo: ${data.roleLabel}`,
        data.inviterName
          ? `Convidado por: ${data.inviterName}`
          : '',
        `Aceite ou rejeite o convite em: ${data.invitationUrl}`,
        `O convite expira em: ${expiresFormatted}`,
      ]
        .filter(Boolean)
        .join('\n'),

      html: `
        <div style="
          font-family:Arial,sans-serif;
          max-width:600px;
          margin:0 auto;
          color:#0f172a;
        ">
          <div style="
            background:#065f46;
            color:white;
            padding:22px;
            border-radius:14px 14px 0 0;
          ">
            <h2 style="margin:0;">
              Mercado Nusali
            </h2>
            <p style="margin:6px 0 0;">
              Convite para equipe de loja
            </p>
          </div>

          <div style="
            padding:24px;
            border:1px solid #e2e8f0;
            border-top:0;
            border-radius:0 0 14px 14px;
          ">
            <p>Olá,</p>

            <p>
              Você foi convidado para integrar a equipe da loja
              <strong>${data.storeName}</strong>
              no Mercado Nusali.
            </p>

            ${
              data.inviterName
                ? `
                  <p>
                    <strong>Convidado por:</strong>
                    ${data.inviterName}
                  </p>
                `
                : ''
            }

            <p>
              <strong>Cargo:</strong>
              ${data.roleLabel}
            </p>

            <div style="margin:28px 0;">
              <a
                href="${data.invitationUrl}"
                style="
                  background:#059669;
                  color:white;
                  text-decoration:none;
                  padding:13px 22px;
                  border-radius:10px;
                  font-weight:bold;
                  display:inline-block;
                "
              >
                Ver Convite
              </a>
            </div>

            <p style="font-size:13px;color:#64748b;">
              Este convite expira em ${expiresFormatted}.
            </p>

            <p style="font-size:13px;color:#64748b;">
              Para aceitar, entre no Mercado Nusali usando exatamente
              o endereço de e-mail que recebeu esta mensagem.
            </p>

            <hr style="
              border:0;
              border-top:1px solid #e2e8f0;
              margin:24px 0;
            " />

            <p style="font-size:12px;color:#94a3b8;">
              Caso você não reconheça este convite,
              pode simplesmente ignorá-lo.
            </p>
          </div>
        </div>
      `,
    });
  }
}