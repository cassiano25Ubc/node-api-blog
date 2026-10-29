# AGENTS.md — node-api-blog

API REST de blog com autenticação, posts, likes e replies. O contrato HTTP vigente é [`docs/api.md`](docs/api.md); [`docs/project-prd.md`](docs/project-prd.md) registra os requisitos de origem e pode não refletir todos os detalhes atuais da implementação.

Antes de mudar comportamento HTTP, conferir `docs/api.md` e atualizar o contrato junto com a implementação quando o comportamento mudar. Não inventar endpoints, campos ou códigos de erro fora desse contrato.

## O que o projeto faz

- Cadastro e login geram um **token de sessão** (hex, 32 bytes) persistido em `users.token` e devolvido ao cliente.
- Listagem e GET de post são **públicos**. Criar/editar/excluir exigem `Authorization: Bearer <token>`.
- Um usuário só edita/exclui **os próprios posts** e só exclui **as próprias replies**. Excluir post remove likes e replies relacionados em cascade.
- Likes são únicos por usuário/post e as ações de curtir/descurtir são idempotentes. Replies pertencem diretamente a um post; não há threads nem likes em replies.
- Além dos endpoints de auth e posts, há endpoints para curtir/descurtir posts e criar/excluir replies; confira a tabela HTTP abaixo para a lista completa.

## Stack

| Peça | Tecnologia |
|------|------------|
| Runtime | Node.js, ESM (`"type": "module"`), TypeScript `strict` |
| HTTP | Express 5 |
| Validação | Zod 4 |
| ORM / banco | Drizzle ORM + PostgreSQL 17 |
| Senha | bcrypt (cost 10) |
| Testes | Vitest + Supertest contra o **banco de teste real** |

O PRD menciona Vite e chama a camada de negócio de service; a implementação usa `tsx` no dev, `tsc` no build e use cases. Siga o código e o `package.json`.

Imports TypeScript usam extensão `.js` (NodeNext): `import { x } from './foo.js'`.

## Comandos

```bash
cp .env.example .env   # se ainda não existir
npm run db:up          # Postgres app :6000 e teste :6001
npm run db:migrate
npm run dev            # http://localhost:3000
npm test               # inicia/migra db-test e executa Vitest
```

Outros: `db:generate` (drizzle-kit), `db:studio`, `db:down`, `build`, `start`.

Os testes precisam do Docker em execução e de `DATABASE_URL_TEST` configurada no `.env`. `npm test` inicia `db-test`, aplica as migrations nesse banco e executa Vitest. `fileParallelism: false` no Vitest — os specs compartilham o mesmo banco.

## Mapa de pastas

```
src/
  server.ts              # dotenv + listen (não importar nos testes)
  app.ts                 # createApp(): json, rotas, errorHandler
  db/schema.ts           # tabelas Drizzle
  db/index.ts            # pool; DATABASE_URL_TEST se NODE_ENV=test
  routes/                # paths HTTP + middleware de auth
  controllers/           # HTTP: validar → use case → DTO → status/json
  use-cases/             # regras de negócio (auth/, posts/, likes/, replies/; sem req/res)
  repositories/          # interfaces *.repository.ts + implementações drizzle-*.repository.ts
  schemas/               # Zod (body/params/query)
  dtos/                  # mapeamento de resposta (auth/, posts/, replies/)
  middlewares/           # requireAuth, errorHandler
  errors/app-error.ts    # AppError + ErrorCode
  types/                 # AuthUser; Express.Request.user
  utils/                 # validate(), generateSessionToken()
tests/                   # *.spec.ts por endpoint (integração HTTP)
docs/                    # PRD, contrato da API, braindump
drizzle/                 # migrations geradas
```

## Arquitetura (obrigatória)

```
Route → Controller → Use Case → Repository (interface)
              ↑                         ↓
         Zod + validate()         Drizzle*Repository → PostgreSQL
              ↓
            DTO (resposta)
```

| Camada | Faz | Não faz |
|--------|-----|---------|
| **Route** | Path, método, middleware `requireAuth`/`optionalAuth` | Validação, regra, SQL |
| **Controller** | `validate()`, chama `useCase.execute()`, mapeia DTO, define status | Acessar `db` / Drizzle |
| **Use case** | Regras (hash, token, ownership, 404/403/409) | Express (`req`/`res`), formato JSON |
| **Repository** | Persistência. Interface em `*.repository.ts`, implementação em `drizzle-*.repository.ts` | HTTP, Zod, `AppError` de negócio |
| **DTO** | Shape estável da resposta (`createdAt` em ISO 8601) | |

Padrão atual: controller instancia o repositório Drizzle e os use cases **no topo do módulo** (singletons).

Exceção existente: `requireAuth` consulta `db.query.users` direto. Não espalhar isso; novos acessos a dados vão no repositório.

O contrato em `docs/api.md` fala em "Service"; no código a camada se chama **use case**. Use esse nome.

## HTTP

Prefixo da API: `/api`. Health: `GET /health` (fora de `/api`).

| Método | Path | Auth |
|--------|------|------|
| `POST` | `/api/auth/register` | não |
| `POST` | `/api/auth/login` | não |
| `GET` | `/api/posts` | não |
| `GET` | `/api/posts/:id` | opcional |
| `POST` | `/api/posts` | sim |
| `PUT` | `/api/posts/:id` | sim |
| `DELETE` | `/api/posts/:id` | sim |
| `POST` | `/api/posts/:id/likes` | sim |
| `DELETE` | `/api/posts/:id/likes` | sim |
| `POST` | `/api/posts/:id/replies` | sim |
| `DELETE` | `/api/posts/:id/replies/:replyId` | sim |

- Register → **201** `{ token, user: { id, name, email } }` (já autenticado).
- Login → **200** mesmo shape; gera **novo** token (substitui o anterior na coluna).
- Create post → **201**; update → **200**; delete → **204** corpo vazio.
- Listagem: query `page` (inteiro ≥ 1, default 1), `limit` **fixo 10**, ordem `createdAt` desc. Envelope `{ data, meta: { page, limit, total, totalPages } }`.
- Listagem inclui `likesCount` e todas as `replies` de cada post em ordem crescente de `createdAt`; detalhe inclui `likesCount`, `likedByMe` e `replies` nessa mesma ordem. Respostas de post/reply expõem o autor como `{ id, name }`, nunca e-mail; senha/hash nunca são retornados.
- Update é **parcial** (`title` e/ou `content`); body `strict`; pelo menos um campo.
- Like/unlike respondem **204** e são idempotentes. Criar reply responde **201**; apagar a própria reply responde **204**. Reply inexistente ou vinculada a outro post dá 404; reply de outra pessoa dá 403.

Erros (sempre este envelope):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

| HTTP | `code` |
|------|--------|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 500 | `INTERNAL_ERROR` |

Lançar `new AppError(status, code, message, details?)`. O `errorHandler` serializa `AppError`, `ZodError` (400) e o resto (500, sem vazar stack).

`validate(schema, data)` faz `safeParse` e lança `AppError` 400 com `details: [{ path, message }]`. Usar nos controllers para body/params/query.

## Autenticação

- Enviar o token no header `Authorization` como `Bearer <token>`. `requireAuth` exige token válido; `optionalAuth` aceita ausência do header, mas rejeita header presente inválido.
- Header: `Authorization: Bearer <token>`. Ausente, malformado, vazio ou desconhecido → 401 `Unauthorized`.
- Token válido: `req.user = { id, name, email }`.
- Ownership (editar/excluir post de outro) → 403 no **use case**, depois de confirmar que o post existe (404 se não existir).
- Login com e-mail/senha errados → 401 genérico `"Invalid email or password"` (não revelar qual falhou).
- E-mail duplicado no register → 409 `"Email already registered"`. E-mail é normalizado para lowercase.

## Banco

Tabelas em `src/db/schema.ts`:

- `users`: `id` serial, `name`, `email` unique, `password` (hash), `token` nullable.
- `posts`: `id` serial, `title`, `content`, `createdAt` (`created_at` timestamptz), `authorId` → `users.id`.
- `likes`: chave primária composta (`userId`, `postId`), um like por usuário/post; `postId` apaga em cascade.
- `replies`: `id`, `content`, `createdAt`, `authorId`, `postId`; `postId` apaga em cascade.

`.env`: app `localhost:6000/blog`, testes `localhost:6001/blog_test`. Docker Compose com volumes separados.

Mudança de schema: editar `schema.ts` → `npm run db:generate` → `npm run db:migrate`. Não editar SQL em `drizzle/` na mão.

## Testes

TDD: para comportamento novo/alterado, começar pelo spec HTTP.

- Arquivos: `tests/<domínio>/<ação>.spec.ts` (inclui `auth/`, `posts/`, `likes/`, `replies/` e `health/`).
- `createApp()` + Supertest. Não subir `server.ts`.
- `beforeEach(cleanDatabase)`, `afterAll(closeDatabase)` (`tests/helpers/database.ts`).
- Sem mock de banco. Exercitar auth, validação, 403/404, persistência quando fizer sentido.
- Assertir `status` + `body.error.code` nos erros; shape completo nas respostas de sucesso.

## Ao adicionar feature

1. Alinhar com `docs/api.md` (ou atualizar o contrato **junto** se o pedido mudar o HTTP).
2. Spec de integração.
3. Schema Zod → route → controller → use case → repositório (interface + Drizzle) → DTO.
4. Não vazar senha/token hash. Não retornar e-mail de autores em posts/replies.
5. Não adicionar logout, perfil, admin, soft delete, threads de replies ou likes em replies, salvo pedido explícito e atualização do contrato.

## Fora de escopo (PRD)

Perfil, troca de senha, logout/invalidação explícita, roles, soft delete, rascunhos, slug, upload, tags, threads de replies, edição de reply, paginação de replies e likes em replies.
