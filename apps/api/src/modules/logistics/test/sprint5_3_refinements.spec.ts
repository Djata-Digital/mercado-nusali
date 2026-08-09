import { Test, TestingModule } from '@nestjs/testing';
import { SecretsEncryptionService } from '../security/secrets-encryption.service';
import { TrackingStateMachineService } from '../tracking/tracking-state-machine.service';
import { CarrierProviderFactory } from '../providers/carrier-provider.factory';
import { NusaliInternalCarrierProvider } from '../providers/nusali-internal-carrier.provider';
import { GenericLocalCarrierProvider } from '../providers/generic-local-carrier.provider';
import { DhlCarrierProvider, UpsCarrierProvider, FedexCarrierProvider, PostalCarrierProvider } from '../providers/external-unconfigured.providers';
import { TrackingStatus, DeliveryRouteStatus } from '@prisma/client';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('Sprint 5.3 Refinements & Corrections Unit Tests', () => {
  describe('SecretsEncryptionService (Items 5 & 6)', () => {
    it('deve aceitar chave Base64 de exatamente 32 bytes', () => {
      const validKey = 'uN8xV4kP7qZ1sT3wY6bR9eF2aC5dH8jM0L2pQ4rT6vY='; // 32 bytes em Base64
      process.env.LOGISTICS_ENCRYPTION_KEY = validKey;
      const service = new SecretsEncryptionService();
      const encrypted = service.encrypt('segredo-teste');
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.keyVersion).toBe('v1');
      expect(encrypted.iv.length).toBe(24); // 12 bytes hex
      expect(service.decrypt(encrypted)).toBe('segredo-teste');
    });

    it('deve rejeitar chave Base64 que não resulte em exatamente 32 bytes sem SHA-256 fallback', () => {
      process.env.LOGISTICS_ENCRYPTION_KEY = 'c2VncmVkbzE='; // 'segredo1' -> 8 bytes
      expect(() => new SecretsEncryptionService()).toThrow(/exatamente 32 bytes/);
    });

    it('deve rejeitar chave que não seja Base64 válida', () => {
      process.env.LOGISTICS_ENCRYPTION_KEY = '!!!chave_invalida!!!';
      expect(() => new SecretsEncryptionService()).toThrow(/não é uma string Base64 válida/);
    });

    it('deve realizar rotação de chaves por keyVersion usando o chaveiro', () => {
      const keyV1 = 'uN8xV4kP7qZ1sT3wY6bR9eF2aC5dH8jM0L2pQ4rT6vY=';
      const keyV2 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; // 32 bytes 0x00
      process.env.LOGISTICS_ENCRYPTION_KEY = keyV1;
      process.env.LOGISTICS_KEYRING_JSON = JSON.stringify({ v1: keyV1, v2: keyV2 });

      const service = new SecretsEncryptionService();
      const encryptedV1 = service.encrypt('dado-v1', 'v1');
      const encryptedV2 = service.encrypt('dado-v2', 'v2');

      expect(encryptedV1.keyVersion).toBe('v1');
      expect(encryptedV2.keyVersion).toBe('v2');

      expect(service.decrypt(encryptedV1)).toBe('dado-v1');
      expect(service.decrypt(encryptedV2)).toBe('dado-v2');
    });
  });

  describe('CarrierProviderFactory & Webhook Signature Order (Items 2 & 11)', () => {
    let factory: CarrierProviderFactory;
    let localProvider: GenericLocalCarrierProvider;

    beforeEach(() => {
      localProvider = new GenericLocalCarrierProvider();
      factory = new CarrierProviderFactory(
        new NusaliInternalCarrierProvider(),
        localProvider,
        new DhlCarrierProvider(),
        new UpsCarrierProvider(),
        new FedexCarrierProvider(),
        new PostalCarrierProvider(),
      );
    });

    it('deve resolver provedor via providerType explícito', () => {
      const provider = factory.getProvider('LOCAL_PARTNER');
      expect(provider).toBe(localProvider);
    });

    it('deve chamar validateWebhook com os argumentos na ordem (headers, payload, secret)', () => {
      const headers = { 'x-local-carrier-signature': 'invalid' };
      const payload = { trackingNumber: '123' };
      const secret = 'my-secret';

      const spy = jest.spyOn(localProvider, 'validateWebhook');
      localProvider.validateWebhook(headers, payload, secret);

      expect(spy).toHaveBeenCalledWith(headers, payload, secret);
    });
  });

  describe('TrackingStateMachineService (Items 4, 13 & 14)', () => {
    it('deve conter DAMAGED na lista de estados terminais', () => {
      const service = new TrackingStateMachineService({} as any);
      expect((service as any).terminalStates.has(TrackingStatus.DAMAGED)).toBe(true);
      expect((service as any).terminalStates.has(TrackingStatus.DELIVERED)).toBe(true);
      expect((service as any).terminalStates.has(TrackingStatus.CANCELLED)).toBe(true);
    });
  });
});
