import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface GeneratedDeliveryCode {
  code: string; // Exposto apenas 1 vez ao cliente/SMS (jamais gravado cru no banco)
  hash: string;
  salt: string;
  challengeId: string;
  expiresAt: Date;
  maxAttempts: number;
}

@Injectable()
export class DeliveryCodeService {
  private readonly secretKey = process.env.LOGISTICS_DELIVERY_CODE_SECRET || 'nusali_delivery_code_secret_key_2026';

  /**
   * Gera um código de entrega curto seguro (6 dígitos) com HMAC-SHA-256 e Salt.
   */
  generateCode(validityMinutes = 120, maxAttempts = 5): GeneratedDeliveryCode {
    const rawNumber = crypto.randomInt(100000, 999999).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const challengeId = crypto.randomUUID();

    const hash = this.hashCode(rawNumber, salt);
    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);

    return {
      code: rawNumber,
      hash,
      salt,
      challengeId,
      expiresAt,
      maxAttempts,
    };
  }

  /**
   * Calcula o hash HMAC-SHA-256 do código curto com o salt fornecido.
   */
  hashCode(code: string, salt: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(`${code}:${salt}`)
      .digest('hex');
  }

  /**
   * Valida se o código de entrega informado pelo destinatário corresponde ao Hash.
   */
  verifyCode(inputCode: string, storedHash: string, salt: string): boolean {
    if (!inputCode || !storedHash || !salt) {
      return false;
    }
    const computedHash = this.hashCode(inputCode.trim(), salt);
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  }
}
