# Tasks API

REST API to manage tasks, built with **NestJS**, **TypeScript**, **TypeORM** and **PostgreSQL**.

It lets you create, list, view, update and delete tasks. Each task has a title, a description, a status (`pending`, `in_progress` or `done`), an assignee and a due date. The list endpoint supports filtering by status and by assignee, plus pagination.

## Requirements

- Node.js 20 or higher and npm
- Docker and Docker Compose (for PostgreSQL)

## How to run it

```bash
# 1. Environment variables
cp .env.example .env

# 2. Database (PostgreSQL in Docker)
docker compose up -d

# 3. Dependencies
npm install

# 4. Migrations (creates the `tasks` table)
npm run migration:run

# 5. Start the API in development mode
npm run start:dev
```

The API is available at `http://localhost:3000`.

Interactive API documentation (Swagger UI) is available at `http://localhost:3000/docs`.

### Environment variables

| Variable | Default (`.env.example`) | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | Port |
| `DB_USER` | `tasks` | User |
| `DB_PASSWORD` | `tasks` | Password |
| `DB_NAME` | `tasks` | Database name |

### Migrations

```bash
npm run migration:generate -- src/migrations/MigrationName   # generates a migration from the entities
npm run migration:run                                        # applies pending migrations
npm run migration:revert                                     # reverts the last migration
```

`synchronize` is disabled: the schema only changes through migrations.

## Tests

The project has two kinds of tests:

- **Unit tests** (`npm test`): check the service and controller logic with mocked dependencies. They need no database.
- **End-to-end tests** (`npm run test:e2e`): start the full application and test it over HTTP against a real PostgreSQL database.

Setup for the e2e tests (one time only):

```bash
# 1. Test environment variables (DB_NAME must be tasks_test)
cp .env.test.example .env.test

# 2. The `tasks_test` database is created automatically by docker/init.sql
#    the first time the volume is created. If your volume already existed:
docker compose exec db psql -U tasks -c "CREATE DATABASE tasks_test;"

# 3. Apply the migrations to the test database
npm run migration:run:test
```

Then:

```bash
npm test
npm run test:e2e
```

The e2e tests empty the `tasks` table before each test, so they refuse to run if `DB_NAME` does not end with `_test`.

## Endpoints

| Method | Route | Description | Success | Errors |
|---|---|---|---|---|
| `POST` | `/tasks` | Create a task | `201` | `400` |
| `GET` | `/tasks` | List tasks with filters and pagination | `200` | `400` |
| `GET` | `/tasks/:id` | Get a task | `200` | `400`, `404` |
| `PATCH` | `/tasks/:id` | Update a task (partial fields) | `200` | `400`, `404` |
| `DELETE` | `/tasks/:id` | Delete a task | `204` | `400`, `404` |

- `400`: invalid data (body, query parameters, or an `id` that is not a UUID).
- `404`: the task does not exist.

### Data model

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Generated automatically |
| `title` | string | Required, 120 characters max |
| `description` | string | Optional |
| `status` | enum | `pending` (default), `in_progress`, `done` |
| `assignee` | string | Required, 80 characters max |
| `dueDate` | date (`YYYY-MM-DD`) | Optional |
| `createdAt` / `updatedAt` | timestamp | Managed by the database |

### List parameters

| Parameter | Description | Default |
|---|---|---|
| `status` | Filter by status | — |
| `assignee` | Filter by assignee (exact match) | — |
| `page` | Page number (minimum 1) | `1` |
| `limit` | Results per page (1 to 100) | `10` |

Tasks are returned from newest to oldest.

### Examples

```bash
# Create
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Prepare report","assignee":"Ana","dueDate":"2026-12-01"}'

# List with filters and pagination
curl "http://localhost:3000/tasks?status=pending&assignee=Ana&page=1&limit=5"

# View, update and delete
curl http://localhost:3000/tasks/<id>
curl -X PATCH http://localhost:3000/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
curl -X DELETE http://localhost:3000/tasks/<id>
```

List response:

```json
{
  "data": [
    {
      "id": "0b6c1f0e-...",
      "title": "Prepare report",
      "description": null,
      "status": "pending",
      "assignee": "Ana",
      "dueDate": "2026-12-01",
      "createdAt": "2026-11-19T10:00:00.000Z",
      "updatedAt": "2026-11-19T10:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 5, "totalPages": 1 }
}
```

Errors use the standard NestJS format:

```json
{
  "message": ["title should not be empty", "property foo should not exist"],
  "error": "Bad Request",
  "statusCode": 400
}
```

## Decisions

- **NestJS**: it provides a clear structure (modules, controllers, services) and dependency injection, which makes testing easier.
- **TypeORM with migrations**: the schema is versioned and applied through migrations, with `synchronize: false`, so database changes are explicit and reproducible.
- **PostgreSQL in Docker Compose**: anyone can start the project with a single command, without external accounts or a local PostgreSQL install. I considered using a free hosted database, but ruled it out because those databases expire and cannot be run by someone else.
- **Validation with DTOs and a global `ValidationPipe`**: `whitelist` and `forbidNonWhitelisted` reject undeclared fields, and `transform` converts query parameters to numbers. Invalid data returns `400` before it reaches the business logic.
- **`ParseUUIDPipe` on `id` parameters**: a malformed identifier returns `400` instead of a database error.
- **Paginated `{ data, meta }` response**: the client gets the total and the number of pages without a second request. The ordering includes `id` as a tie-breaker so pagination is stable.
- **`assignee` as plain text**: keeps the model simple for the scope of the challenge.
- **Two levels of tests**: unit tests with mocked dependencies for the logic, and e2e tests against a real PostgreSQL database to verify the integration (validation, HTTP status codes, migrations and the SQL behind the filters). The e2e tests use a separate database, with a guard that prevents running them against the development database.
- **OpenAPI documentation with `@nestjs/swagger`** and its CLI plugin, which infers the schema from the DTOs and avoids duplicating the information already declared with `class-validator`.

## What I would do with more time

- **Assignee as an entity**: a `users` table and a relation with tasks, instead of free text.
- **Authentication and authorization** (for example JWT), so each user sees and edits only what they should.
- **A Dockerfile for the API** and an `api` service in the compose file, to start everything with a single command.
- **Continuous integration** (GitHub Actions) running lint, unit tests and e2e tests with a PostgreSQL service.
- **Case-insensitive assignee filter** with partial matching (`ILike`), escaping wildcard characters.
- **Stricter date validation** with `@IsISO8601({ strict: true })` to reject non-existent dates such as `2026-02-30`.
- **Handling `null` in `PATCH`**: right now `@IsOptional()` lets `null` through on required fields, and it should be rejected explicitly.
- **Configurable sorting** and filters by due date range.
- **Logging and global error handling**, with a custom exception filter.

## How I used AI

I used **Claude (Anthropic)** as a guide and support tool during development, not as a generator of a finished project.

- **Planning**: I asked for a step-by-step guide (database, entity, migrations, DTOs, service and controller, tests) and moved forward one step at a time, with one commit per step.
- **Code**: it proposed code for each step (entity, DTOs, service, controller and tests), which I integrated into the project and ran with the test suite.
- **Debugging**: I pasted the real errors I ran into and fixed them with its help: missing imports in the entity, `useGlobalPipes` placed after `listen` in `main.ts`, a missing migrations script, a typo in a `package.json` flag, and a missing table in the test database.
- **Learning**: I asked it to explain concepts I was unsure about: the difference between pipes and middleware, how `autoLoadEntities` works, how unit and e2e tests work, and why e2e tests use a real database.
- **Decisions**: I compared using a free hosted database against Docker, and chose Docker for reproducibility.

[ADJUST THIS SECTION in your own words: which parts you wrote yourself, what you changed from what the AI suggested, what you did not understand at first and how you verified it.]
