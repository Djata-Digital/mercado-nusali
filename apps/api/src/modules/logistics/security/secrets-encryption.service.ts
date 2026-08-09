import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptedSecretData {
  version: number;
  keyVersion: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

@Injectable()
export class SecretsEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyring = new Map<string, Buffer>();
  private readonly activeKeyVersion: string;

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    const activeVersion = process.env.LOGISTICS_ACTIVE_KEY_VERSION || 'v1';
    const mainKeyBase64 = process.env.LOGISTICS_ENCRYPTION_KEY;

    if (isProd && (!mainKeyBase64 || mainKeyBase64.trim() === '')) {
      throw new Error('Ambiente de produção exige a definição da variável LOGISTICS_ENCRYPTION_KEY.');
    }

    const defaultDevKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
    const keyToValidate = mainKeyBase64 || defaultDevKey;

    const keyBuffer = this.parseAndValidateBase64Key(keyToValidate, 'LOGISTICS_ENCRYPTION_KEY');
    this.keyring.set(activeVersion, keyBuffer);
    this.activeKeyVersion = activeVersion;

    if (process.env.LOGISTICS_KEYRING_JSON) {
      try {
        const parsedKeyring = JSON.parse(process.env.LOGISTICS_KEYRING_JSON);
        for (const [ver, b64] of Object.entries(parsedKeyring)) {
          if (typeof b64 === 'string') {
            const buf = this.parseAndValidateBase64Key(b64, `LOGISTICS_KEYRING_JSON.${ver}`);
            this.keyring.set(ver, buf);
          }
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Base64')) throw err;
        throw new Error(`Falha ao carregar chaveiro LOGISTICS_KEYRING_JSON: ${err.message}`);
      }
    }
  }

  private parseAndValidateBase64Key(keyBase64: string, varName: string): Buffer {
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(keyBase64)) {
      throw new Error(`A chave de criptografia em ${varName} não é uma string Base64 válida.`);
    }

    const buffer = Buffer.from(keyBase64, 'base64');
    if (buffer.length !== 32) {
      throw new Error(
        `A chave de criptografia em ${varName} deve conter exatamente 32 bytes (256 bits) após decodificação Base64. Tamanho recebido: ${buffer.length} bytes.`,
      );
    }

    return buffer;
  }

  /**
   * Criptografa um texto ou objeto JSON usando AES-256-GCM com a chave ativa ou a versão de chave especificada.
   */
  encrypt(data: string | Record<string, any>, keyVersion?: string): EncryptedSecretData {
    try {
      const targetVersion = keyVersion || this.activeKeyVersion;
      const secretKey = this.keyring.get(targetVersion);

      if (!secretKey) {
        throw new InternalServerErrorException(`Versão da chave de criptografia '${targetVersion}' não encontrada no chaveiro.`);
      }

      const textToEncrypt = typeof data === 'string' ? data : JSON.stringify(data);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, secretKey, iv);

      let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');

      return {
        version: 1,
        keyVersion: targetVersion,
        iv: iv.toString('hex'),
        authTag,
        ciphertext: encrypted,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`Erro ao criptografar segredo logístico: ${error.message}`);
    }
  }

  /**
   * Descriptografa uma estrutura de segredo usando AES-256-GCM com a versão de chave especificada na própria estrutura (`keyVersion`).
   */
  decrypt(encryptedData: EncryptedSecretData): string {
    try {
      if (!encryptedData || !encryptedData.iv || !encryptedData.authTag || !encryptedData.ciphertext) {
        throw new Error('Estrutura de dados criptografados inválida.');
      }

      const keyVersion = encryptedData.keyVersion || 'v1';
      const secretKey = this.keyring.get(keyVersion);

      if (!secretKey) {
        throw new InternalServerErrorException(`Chave de criptografia versão '${keyVersion}' não encontrada no chaveiro.`);
      }

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, secretKey, iv);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      throw new InternalServerErrorException(`Erro ao descriptografar segredo logístico: ${error.message}`);
    }
  }

  /**
   * Tenta descriptografar um objeto JSON.
   */
  decryptJson<T = Record<string, any>>(encryptedData: EncryptedSecretData): T {
    const raw = this.decrypt(encryptedData);
    return JSON.parse(raw) as T;
  }
}
