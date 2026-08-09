# Arquitetura do Backend - Mercado Nusali

## Visão Geral
O backend do **Mercado Nusali** é desenvolvido em NestJS 11 com TypeScript, utilizando Prisma ORM para acesso ao PostgreSQL, Redis para cache/filas/rate-limiting, Socket.IO para websockets e MinIO (S3) para armazenamento de arquivos.

## Módulos Estruturais
1. `ConfigModule`: Gerenciamento centralizado de variáveis de ambiente.
2. `PrismaModule`: Acesso ao banco PostgreSQL via Prisma Client.
3. `RedisModule`: Conexão resiliente com Redis usando `ioredis`.
4. `QueueModule`: Processamento assíncrono em segundo plano via `@nestjs/bullmq`.
5. `SocketModule`: Gateway WebSocket Socket.IO.
6. `StorageModule`: Comunicação com S3/MinIO com separação estrita de buckets públicos e privados.
7. `MailModule`: Abstração de envio de e-mails (`MailProvider` + `ConsoleMailProvider`).
8. `HealthModule`: Monitoramento de saúde e probes K8s/Docker.
9. `AuthModule`: Autenticação JWT, Refresh Token com rotação e família de tokens.
10. `UsersModule`: Gestão de usuários e perfis.
11. `RolesModule`: Controle de Roles RBAC.
12. `PermissionsModule`: Controle de Permissões granulares.
13. `CountriesModule`: Dados de referência geográfica (GW, BR, PT, AO).
14. `CurrenciesModule`: Moedas suportadas (XOF, BRL, EUR, AOA, USD).
15. `LanguagesModule`: Idiomas da plataforma (pt, en, fr).
16. `AuditModule`: Auditoria detalhada com `requestId` e contexto do cliente.

## Segurança e Token Rotation
- Refresh Tokens nunca são salvos em texto puro (apenas HASH SHA-256).
- A cada refresh, o token antigo é revogado e um novo par é gerado sob a mesma `familyId`.
- Caso um token revogado seja reutilizado (indício de vazamento), toda a família de tokens e sessões do usuário são revogadas.
