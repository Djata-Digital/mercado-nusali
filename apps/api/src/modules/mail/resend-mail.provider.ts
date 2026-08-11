import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Resend } from 'resend';
import {
  MailProvider,
  SendMailOptions,
} from './mail.provider';

@Injectable()
export class ResendMailProvider implements MailProvider {
  private readonly logger = new Logger(ResendMailProvider.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY environment variable is required.',
      );
    }

    this.resend = new Resend(apiKey);

    this.fromAddress =
      process.env.MAIL_FROM ||
      'Mercado Nusali <no-reply@mail.nusali.com>';
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const { data, error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: [options.to],
      subject: options.subject,
      text: options.body,
      html: options.html,
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar e-mail para ${options.to}: ${error.message}`,
      );

      throw new InternalServerErrorException(
        'Não foi possível enviar o e-mail.',
      );
    }

    this.logger.log(
      `E-mail enviado com sucesso para ${options.to}. Resend ID: ${data?.id}`,
    );
  }
}