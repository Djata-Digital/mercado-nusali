import { PaymentLogSanitizerService } from './payment-log-sanitizer.service';

describe('PaymentLogSanitizerService', () => {
  const service = new PaymentLogSanitizerService();

  it('deve mascarar campos sensíveis em qualquer nível', () => {
    expect(
      service.sanitize({
        authorization: 'Bearer abc',
        nested: {
          apiKey: 'key-123',
          clientSecret: 'secret-123',
          password: 'pass-123',
          signature: 'sig-123',
        },
      }),
    ).toEqual({
      authorization: '********',
      nested: {
        apiKey: '********',
        clientSecret: '********',
        password: '********',
        signature: '********',
      },
    });
  });

  it('deve sanitizar Bearer e segredos embutidos em strings', () => {
    expect(
      service.sanitizeText(
        'Authorization: Bearer abc.def token=tok-123 secret:sec-456',
      ),
    ).not.toContain('abc.def');
    expect(service.sanitizeText('token=tok-123')).toBe('token=********');
  });

  it('deve funcionar com arrays e objetos aninhados', () => {
    expect(
      service.sanitize([{ token: 'one' }, { safe: 'ok', secret: 'two' }]),
    ).toEqual([
      { token: '********' },
      { safe: 'ok', secret: '********' },
    ]);
  });

  it('não deve modificar o objeto original', () => {
    const original = { headers: { authorization: 'Bearer original' } };
    const safe = service.sanitize(original) as any;

    expect(original.headers.authorization).toBe('Bearer original');
    expect(safe.headers.authorization).toBe('********');
  });

  it('deve tratar referência circular sem lançar exceção', () => {
    const value: Record<string, unknown> = { id: 'payment-1' };
    value.self = value;

    expect(service.sanitize(value)).toEqual({
      id: 'payment-1',
      self: '[Circular]',
    });
  });

  it('deve sanitizar mensagens de Error', () => {
    const result = service.sanitize(
      new Error('provider failed token=super-secret'),
    ) as any;

    expect(result.message).toContain('token=********');
    expect(result.message).not.toContain('super-secret');
  });
});
