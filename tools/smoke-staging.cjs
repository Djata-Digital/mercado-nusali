const baseArg = process.argv[2] || process.env.PUBLIC_API_URL;
if (!baseArg) {
  console.error('Uso: node tools/smoke-staging.cjs https://api-staging.seudominio.com');
  process.exit(1);
}
const base = baseArg.replace(/\/$/, '');
if (!base.startsWith('https://')) {
  console.error('FAIL staging smoke exige HTTPS.');
  process.exit(1);
}
const apiPrefix = process.env.API_PREFIX || 'api/v1';

async function check(path, expected = 200) {
  const url = base + '/' + apiPrefix + path;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mercado-Nusali-Staging-Smoke/1.0' } });
  const text = await res.text();
  if (res.status !== expected) {
    throw new Error(path + ' retornou ' + res.status + ': ' + text.slice(0, 300));
  }
  console.log('OK', path, res.status);
  return text;
}

(async () => {
  console.log('=== Mercado Nusali Remote Staging Smoke ===');
  await check('/health/live');
  await check('/health/ready');
  await check('/public/stores');
  console.log('Remote Staging Smoke: PASS');
})().catch((error) => {
  console.error('FAIL', error.message);
  process.exit(1);
});
