import { Injectable, Logger } from '@nestjs/common';

export interface IDeliveryCodeNotificationProvider {
  sendDeliveryCode(phone: string, recipientName: string, code: string): Promise<void>;
}

@Injectable()
export class ConsoleDeliveryCodeProvider implements IDeliveryCodeNotificationProvider {
  private readonly logger = new Logger(ConsoleDeliveryCodeProvider.name);

  async sendDeliveryCode(phone: string, recipientName: string, code: string): Promise<void> {
    this.logger.log(`[SIMULATED SMS/WHATSAPP] Envio de PIN para ${recipientName} (${phone}): Código PIN=${code}`);
  }
}

@Injectable()
export class DeliveryCodeNotificationService {
  private readonly logger = new Logger(DeliveryCodeNotificationService.name);

  constructor(private readonly consoleProvider: ConsoleDeliveryCodeProvider) {}

  async notifyRecipient(phone: string | undefined, recipientName: string, code: string): Promise<void> {
    const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;

    if (isDevOrTest) {
      await this.consoleProvider.sendDeliveryCode(phone || 'N/A', recipientName, code);
      return;
    }

    if (!process.env.SMS_PROVIDER_API_KEY) {
      this.logger.error(`[PROD ERROR] Provedor de notificação SMS/WhatsApp para entrega não configurado.`);
      throw new Error('Provedor de notificação de código de entrega não configurado para ambiente de produção.');
    }
  }
}
