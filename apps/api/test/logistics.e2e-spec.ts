import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { SecretsEncryptionService } from '../src/modules/logistics/security/secrets-encryption.service';
import * as crypto from 'crypto';

jest.setTimeout(30000);

describe('Logistics HTTP E2E (Sprint 5.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let secretsEncryption: SecretsEncryptionService;
  const webhookSecret = 'test-secret-123';

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mercado_nusali_test?schema=public';
    process.env.LOGISTICS_ENCRYPTION_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
    secretsEncryption = app.get(SecretsEncryptionService);

    // Seed transportadora e conta para os testes E2E
    const encryptedSecret = JSON.stringify(secretsEncryption.encrypt(webhookSecret));
    const carrier = await prisma.carrier.upsert({
      where: { code: 'NUSALI_EXPRESS' },
      update: { status: 'ACTIVE', providerType: 'INTERNAL' },
      create: {
        code: 'NUSALI_EXPRESS',
        name: 'Nusali Express Test',
        providerType: 'INTERNAL',
        status: 'ACTIVE',
      },
    });

    await prisma.carrierAccount.deleteMany({ where: { carrierId: carrier.id } });
    await prisma.carrierAccount.create({
      data: {
        carrierId: carrier.id,
        environment: 'SANDBOX',
        status: 'ACTIVE',
        credentialsEncryptedJson: {},
        webhookSecretEncrypted: encryptedSecret,
        providerType: 'INTERNAL',
      },
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/public/carriers -> deve retornar transportadoras públicas ativas', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/carriers')
      .expect(200);

    const list = res.body.data || res.body;
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/v1/logistics/webhooks/:carrierCode -> deve aceitar webhook validado com HTTP 202 Accepted', async () => {
    const payload = {
      trackingNumber: 'TRK-NUSALI-12345',
      status: 'IN_TRANSIT',
      eventCode: 'IN_TRANSIT',
      title: 'Em transporte para o centro de distribuição',
      eventAt: new Date().toISOString(),
    };

    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const res = await request(app.getHttpServer())
      .post('/api/v1/logistics/webhooks/NUSALI_EXPRESS')
      .set('x-nusali-signature', signature)
      .send(payload)
      .expect(202);

    const data = res.body.data || res.body;
    expect(data.accepted).toBe(true);
  });

  it('GET /api/v1/public/tracking/NON_EXISTENT -> deve retornar HTTP 404 para rastreamento inexistente', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/public/tracking/NON_EXISTENT_99999')
      .expect(404);
  });
});
