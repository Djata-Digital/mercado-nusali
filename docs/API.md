# Mercado Nusali API Documentation

## Base URL
`/api/v1`

## Documentação Swagger Interativa
Disponível em: `http://localhost:3000/docs`

## Endpoints de Autenticação (`/api/v1/auth`)

| Método | Rota | Descrição | Protegido |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Cadastro público (atribui role BUYER) | Não |
| POST | `/api/v1/auth/login` | Autenticação com e-mail/telefone e senha | Não |
| POST | `/api/v1/auth/refresh` | Renovação de access token com rotação e reuso detectado | Não |
| POST | `/api/v1/auth/logout` | Encerramento de sessão e revogação de tokens | Sim |
| GET | `/api/v1/auth/me` | Retorna perfil do usuário logado | Sim |
| POST | `/api/v1/auth/forgot-password` | Envia código/token para redefinição de senha | Não |
| POST | `/api/v1/auth/reset-password` | Redefine senha com token | Não |
| POST | `/api/v1/auth/verify-email` | Validação de e-mail | Não |
| POST | `/api/v1/auth/verify-phone` | Validação de telefone | Não |
| POST | `/api/v1/auth/resend-verification` | Reenvio de código de validação | Sim |
| POST | `/api/v1/auth/change-password` | Alteração de senha da conta autenticada | Sim |
| GET | `/api/v1/auth/sessions` | Listagem de sessões ativas | Sim |
| DELETE | `/api/v1/auth/sessions/:sessionId` | Revogação de sessão específica | Sim |
| DELETE | `/api/v1/auth/sessions` | Revogação de todas as sessões | Sim |

## Endpoints de Health (`/api/v1/health`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/health` | Health Check Completo (API, Banco de Dados, Redis) |
| GET | `/api/v1/health/live` | Liveness Probe |
| GET | `/api/v1/health/ready` | Readiness Probe |

## Respostas de Sucesso (Padrão)
```json
{
  "success": true,
  "data": {}
}
```

## Respostas de Erro (Padrão)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Credenciais inválidas.",
    "details": null,
    "fieldErrors": null,
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
}
```
