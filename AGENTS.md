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
| Upload | multer (só na borda, `memoryStorage`) + sharp → disco |
| E-mail | nodemailer; Mailpit (SMTP dev/teste) |
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
  storage/               # porta ImageStorage + implementação sharp/disco
  mail/                  # porta Mailer + implementação nodemailer
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
5. Não adicionar logout, perfil (além do avatar), admin, soft delete, threads de replies ou likes em replies, salvo pedido explícito e atualização do contrato.

## Upload de imagens (foto do post e avatar do usuário)

Fluxo obrigatório: **Route (multer) → Controller → Use Case (recebe `Buffer`) → `ImageStorage` (sharp + disco) → Repository (salva o path)**.

- **Multer só na borda**: usado apenas em `routes/` (ou middleware em `middlewares/`) com `memoryStorage()`, `limits.fileSize` e `fileFilter` de MIME (`image/jpeg`, `image/png`, `image/webp`). Nunca `diskStorage`. Multer/`Express.Multer.File` não pode aparecer em use cases, repositórios ou DTOs.
- **Controller** valida o campo do arquivo (ausente → `VALIDATION_ERROR` 400) e passa `file.buffer` ao use case. Erros do multer (tamanho, tipo, campo inesperado) viram `AppError` 400 `VALIDATION_ERROR` no `errorHandler`.
- **Use case** recebe `Buffer` (não `req`/`file`), aplica as regras (ownership, 404/403) e chama uma porta `ImageStorage` (interface em `src/storage/` ou similar, implementação `sharp-image-storage.ts`) injetada no construtor.
- **Sharp** (somente na implementação de storage): valida que o buffer é imagem de verdade, redimensiona/normaliza (ex.: avatar quadrado pequeno, foto do post com largura máxima), converte para um formato único (ex.: webp), remove metadados e grava em disco com nome gerado (UUID). Nunca usar o nome original do cliente.
- **Banco guarda só o path relativo** (ex.: `avatars/<uuid>.webp`, `posts/<uuid>.webp`), em colunas nullable (`users.avatarPath`, `posts.imagePath`). Nunca o binário nem path absoluto. Mudança de schema segue o fluxo do `db:generate`.
- **Diretório**: configurado por env `UPLOADS_DIR` (default `uploads/`, no `.gitignore`); nos testes usar diretório temporário próprio (ex.: `uploads-test/`, também ignorado) e limpá-lo junto com `cleanDatabase`. Servir via `express.static` em `/uploads` ou expor URL montada no DTO (`avatarUrl`, `imageUrl`: `null` quando ausente) — nunca o path de disco.
- Ao substituir ou remover imagem (e ao excluir post em cascade), apagar o arquivo antigo do disco; falha ao apagar arquivo não pode quebrar a requisição (logar).
- Se a gravação em disco funcionar mas a persistência falhar, remover o arquivo órfão.
- Atualizar `docs/api.md` (endpoints, `multipart/form-data`, nomes de campos, limites, erros) junto com a implementação. Não inventar endpoints além dos pedidos.
- Testes: Supertest com `.attach()` e fixtures pequenas em `tests/fixtures/`; cobrir sucesso (arquivo existe em disco e path salvo), MIME inválido, arquivo corrompido, acima do limite, sem auth (401) e ownership (403).

## E-mail (notificação de nova reply)

Quando alguém cria uma reply em um post, o **autor do post** recebe um e-mail. Não notificar se o autor da reply é o próprio autor do post.

- **Nodemailer** só na implementação de uma porta `Mailer` (interface em `src/mail/`, implementação `nodemailer-mailer.ts`), injetada no use case `create-reply`. Use case não importa `nodemailer`; o template do e-mail (assunto/texto) é montado fora do transporte.
- **Falha de e-mail nunca derruba a criação da reply**: a reply é persistida e responde **201** mesmo se o envio falhar (capturar e logar o erro). Não bloquear a resposta HTTP esperando SMTP quando possível, mas os testes precisam conseguir aguardar o envio de forma determinística.
- Nunca incluir senha, token ou dados sensíveis no e-mail. Escapar o conteúdo da reply se o e-mail tiver HTML.
- **Mailpit** é o SMTP de desenvolvimento e teste: adicionar serviço `mailpit` ao `docker-compose.yml` (SMTP `1025`, UI/API HTTP `8025`; portas de host configuráveis). Configuração por env, documentada em `.env.example`: `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` (e `MAIL_API_URL` / `MAILPIT_URL` para os testes). Sem credenciais reais no repositório.
- Testes de integração enviam via SMTP real para o Mailpit e verificam pela API HTTP do Mailpit (`/api/v1/messages`, destinatário, assunto); limpar as mensagens (`DELETE /api/v1/messages`) em `beforeEach`. Também cobrir: sem e-mail quando o autor da reply é o dono do post, e reply criada com sucesso quando o SMTP está indisponível. Os testes exigem o Mailpit rodando (`npm run db:up` / compose); manter os scripts de `npm test` iniciando-o.
- Comportamento de e-mail não altera o contrato HTTP; documentar a notificação em `docs/api.md` apenas como efeito colateral.

## Fora de escopo (PRD)

Perfil (exceto avatar e foto de post descritos acima), troca de senha, logout/invalidação explícita, roles, soft delete, rascunhos, slug, tags, threads de replies, edição de reply, paginação de replies e likes em replies. Upload limitado a avatar do usuário e foto do post; e-mail limitado à notificação de nova reply.
