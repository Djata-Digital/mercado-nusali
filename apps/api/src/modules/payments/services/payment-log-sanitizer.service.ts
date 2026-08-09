import { Injectable } from '@nestjs/common';

const REDACTED = '********';
const CIRCULAR = '[Circular]';

/**
 * PaymentLogSanitizerService
 *
 * Remove segredos de payloads antes que eles sejam gravados em auditoria,
 * Outbox ou logs do Payment Core. O serviço nunca modifica o objeto original.
 *
 * A sanitização é deliberadamente defensiva: além de nomes de campos
 * sensíveis, também mascara credenciais embutidas em strings (Bearer, Basic,
 * token=..., secret=..., etc.).
 */
@Injectable()
export class PaymentLogSanitizerService {
  private readonly sensitiveKeyPattern =
    /^(authorization|proxy-authorization|api[-_]?key|x-api-key|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|token|password|passwd|signature|cookie|set-cookie|private[-_]?key)$/i;

  sanitize<T>(value: T): unknown {
    return this.cloneAndSanitize(value, new WeakSet<object>());
  }

  sanitizeText(value: string): string {
    return value
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 ********')
      .replace(
        /\b(api[-_]?key|client[-_]?secret|secret|access[-_]?token|refresh[-_]?token|token|password|passwd|signature)\s*[:=]\s*([^\s,;]+)/gi,
        '$1=********',
      );
  }

  private cloneAndSanitize(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') return this.sanitizeText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;

    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;

    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.sanitizeText(value.message),
        ...(value.stack ? { stack: this.sanitizeText(value.stack) } : {}),
      };
    }

    if (typeof value !== 'object') return String(value);

    const objectValue = value as object;
    if (seen.has(objectValue)) return CIRCULAR;
    seen.add(objectValue);

    try {
      if (Array.isArray(value)) {
        return value.map((item) => this.cloneAndSanitize(item, seen));
      }

      // Prisma.Decimal e objetos equivalentes devem ser serializados como
      // valor, não percorridos como estrutura interna da biblioteca.
      const constructorName = (value as { constructor?: { name?: string } })
        .constructor?.name;
      if (constructorName === 'Decimal' && 'toString' in value) {
        return String(value);
      }

      const result: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        result[key] = this.sensitiveKeyPattern.test(key)
          ? REDACTED
          : this.cloneAndSanitize(nestedValue, seen);
      }
      return result;
    } finally {
      // O WeakSet representa apenas o caminho atual. Assim uma referência
      // compartilhada em dois ramos não é confundida com ciclo real.
      seen.delete(objectValue);
    }
  }
}
