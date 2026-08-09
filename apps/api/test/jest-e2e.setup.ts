/**
 * Configuração global das suítes HTTP E2E.
 *
 * - usa uma chave AES-256-GCM de teste com exatamente 32 bytes;
 * - impede que workers BullMQ tentem abrir conexões Redis reais nas suítes
 *   E2E mockadas quando REDIS_URL_TEST não foi fornecida.
 *
 * Testes de integração real podem definir REDIS_URL_TEST e continuar usando
 * Redis/BullMQ reais.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOGISTICS_ENCRYPTION_KEY =
  process.env.LOGISTICS_ENCRYPTION_KEY ||
  'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

if (!process.env.REDIS_URL_TEST) {
  process.env.DISABLE_BULLMQ_WORKERS = 'true';
}
