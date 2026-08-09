# Mercado Nusali — Staging Release Checklist

## Antes do deploy
1. Copiar `.env.staging.example` para `.env.staging`.
2. Substituir todos os placeholders por secrets/hosts reais.
3. Executar:
   `node tools/check-staging-env.cjs .env.staging`
4. Executar a suíte local verde:
   `npm run check:production:readiness`
5. Aplicar migrations no banco de staging **uma única vez por release**:
   `npm run db:deploy`
6. Buildar e publicar a imagem da API.

## Depois do deploy
1. Confirmar `/api/v1/health/live`.
2. Confirmar `/api/v1/health/ready` (PostgreSQL + Redis + Object Storage).
3. Executar:
   `node tools/smoke-staging.cjs https://api-staging.seudominio.com`
4. Publicar frontend com as variáveis VITE_* do staging.
5. Fazer smoke manual Buyer → Seller → Admin → Fulfillment.
6. Só promover para produção depois de staging verde.

## Importante
Migrations não são executadas automaticamente no startup da API para evitar corrida entre réplicas.
