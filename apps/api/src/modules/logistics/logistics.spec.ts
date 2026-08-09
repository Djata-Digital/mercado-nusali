import { SecretsEncryptionService } from './security/secrets-encryption.service';
import { DeliveryCodeService } from './security/delivery-code.service';
import { PublicTrackingMapper } from './tracking/public-tracking.mapper';
import {
  DhlCarrierProvider,
  UpsCarrierProvider,
  FedexCarrierProvider,
  PostalCarrierProvider,
} from './providers/external-unconfigured.providers';
import { NusaliInternalCarrierProvider } from './providers/nusali-internal-carrier.provider';
import { GenericLocalCarrierProvider } from './providers/generic-local-carrier.provider';
import { CarrierProviderFactory } from './providers/carrier-provider.factory';
import { NotImplementedException, BadRequestException } from '@nestjs/common';

describe('LogisticsModule - Sprint 5.3 Unit Tests', () => {
  describe('SecretsEncryptionService (AES-256-GCM)', () => {
    let service: SecretsEncryptionService;

    beforeEach(() => {
      service = new SecretsEncryptionService();
    });

    it('deve criptografar e descriptografar credenciais com IV de 12 bytes e AuthTag (AES-256-GCM)', () => {
      const payload = { apiKey: 'secret_live_key_12345', webhookSecret: 'sec_wh_9988' };
      const encrypted = service.encrypt(payload);

      expect(encrypted.version).toBe(1);
      expect(encrypted.keyVersion).toBe('v1');
      expect(encrypted.iv).toHaveLength(24); // 12 bytes hex
      expect(encrypted.authTag).toHaveLength(32); // 16 bytes hex
      expect(encrypted.ciphertext).toBeDefined();

      const decrypted = service.decryptJson(encrypted);
      expect(decrypted).toEqual(payload);
    });

    it('deve falhar ao tentar descriptografar se a authTag ou IV estiver corrompido', () => {
      const encrypted = service.encrypt('super_secret');
      encrypted.authTag = '00000000000000000000000000000000'; // AuthTag fake

      expect(() => service.decrypt(encrypted)).toThrow();
    });
  });

  describe('DeliveryCodeService (HMAC-SHA-256)', () => {
    let service: DeliveryCodeService;

    beforeEach(() => {
      service = new DeliveryCodeService();
    });

    it('deve gerar código curto de 6 dígitos com Hash HMAC-SHA-256 e Salt', () => {
      const generated = service.generateCode(120, 5);

      expect(generated.code).toMatch(/^\d{6}$/);
      expect(generated.salt).toHaveLength(32);
      expect(generated.hash).toHaveLength(64); // SHA-256 hex
      expect(generated.challengeId).toBeDefined();
    });

    it('deve verificar o código curto corretamente usando o mesmo salt', () => {
      const generated = service.generateCode();
      const isValid = service.verifyCode(generated.code, generated.hash, generated.salt);
      const isInvalid = service.verifyCode('000000', generated.hash, generated.salt);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe('CarrierProviderFactory & Providers', () => {
    let factory: CarrierProviderFactory;
    let nusali: NusaliInternalCarrierProvider;
    let local: GenericLocalCarrierProvider;
    let dhl: DhlCarrierProvider;

    beforeEach(() => {
      nusali = new NusaliInternalCarrierProvider();
      local = new GenericLocalCarrierProvider();
      dhl = new DhlCarrierProvider();

      factory = new CarrierProviderFactory(
        nusali,
        local,
        dhl,
        new UpsCarrierProvider(),
        new FedexCarrierProvider(),
        new PostalCarrierProvider(),
      );
    });

    it('deve retornar o provider correto via Dependency Injection', () => {
      const p1 = factory.getProvider('NUSALI_EXPRESS');
      expect(p1.carrierCode).toBe('NUSALI_EXPRESS');

      const p2 = factory.getProvider('DHL_EXPRESS');
      expect(p2.carrierCode).toBe('DHL_EXPRESS');
    });

    it('deve lançar erro controlado ao chamar transportadora externa não configurada (DHL)', async () => {
      await expect(dhl.createShipment({} as any)).rejects.toThrow(NotImplementedException);
    });

    it('deve gerar número de rastreamento determinístico no NusaliInternalCarrierProvider (Simulado)', async () => {
      const result = await nusali.createShipment({
        shipmentId: 'ship-1',
        shipmentCode: 'SHP-001',
        orderId: 'ord-1',
        warehouseId: 'wh-1',
        originAddress: {},
        destinationAddress: {},
        packages: [{ packageCode: 'PKG-1', weight: 1.5 }],
      });

      expect(result.trackingNumber).toContain('NUS-');
      expect(result.metadataJson?.simulated).toBe(true);
    });
  });

  describe('PublicTrackingMapper (Privacidade e Sanitização)', () => {
    it('deve sanitizar dados pessoais, documentos e coordenadas no endpoint público', () => {
      const tracking = {
        trackingNumber: 'NUS-998877',
        currentStatus: 'IN_TRANSIT',
        carrier: { name: 'Nusali Express' },
        originCountry: { name: 'Guiné-Bissau' },
        destinationCountry: { name: 'Brasil' },
        events: [
          {
            eventCode: 'IN_TRANSIT',
            status: 'IN_TRANSIT',
            title: 'Entregue ao motorista João CPF 123.456.789-00 tel +5511999999999',
            description: 'Contato comprador test@email.com',
            eventAt: new Date(),
          },
        ],
      };

      const publicView = PublicTrackingMapper.toPublic(tracking);

      expect(publicView.trackingNumber).toBe('NUS-998877');
      expect(publicView.events[0].title).not.toContain('123.456.789-00');
      expect(publicView.events[0].title).toContain('[DOCUMENTO]');
      expect(publicView.events[0].description).toContain('[EMAIL]');
    });
  });
});
