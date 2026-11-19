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

# 2. Create `tasks_test` database 
docker compose exec db psql -U tasks -c "CREATE DATABASE tasks_test;"

# 3. Apply the migrations to the test database
npm run migration:run:test
```

Then:

```bash
npm test
npm run test:e2e
```

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

- **NestJS**: it gives a clear structure (modules, controllers and services) and it is easy to test.
- **TypeORM with migrations**: I wanted every change in the database to be written down and easy to repeat, so `synchronize` is off.
- **PostgreSQL with Docker Compose**: anyone can start the project with one command. I thought about using a free database online, but those expire after some time, and other people could not use mine.
- **DTOs and a global `ValidationPipe`**: fields that are not in the DTO are rejected, and the query params are changed to numbers. If the data is not valid, the API returns `400` before the logic runs.
- **`ParseUUIDPipe` for the `id`**: if the id is not a valid UUID, the API returns `400` and not a database error.
- **Paginated response with `{ data, meta }`**: the client gets the total and the number of pages in the same request. I also sort by `id` as a second rule, so the pages do not change order.
- **`assignee` as plain text**: it keeps the model simple for this challenge.
- **Two kinds of tests**: unit tests for the logic, and e2e tests with a real PostgreSQL database to check that everything works together (validation, status codes, migrations and the filters). The e2e tests use their own database, and they stop if the database name does not end with `_test`.

## What I would do with more time

- Make the assignee a real entity (a `users` table) and not just text.
- Add authentication (for example JWT), so each user only sees and edits what they should.
- Add a Dockerfile for the API and an `api` service in the compose file, to start everything with one command.
- Add continuous integration (GitHub Actions) to run lint, unit tests and e2e tests.
- Make the assignee filter case-insensitive and allow partial search.
- Let the client choose the sorting, and add filters by due date.
- Add logs and a global error handler.

## How I used AI

The project is small, so I mostly used AI for code completion and code suggestions.

- I used it to generate the tests. I reviewed them and adjusted them by hand.
- I used it to help me write this README.
