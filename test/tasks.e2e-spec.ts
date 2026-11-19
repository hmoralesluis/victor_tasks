import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Task } from '../src/tasks/entities/task.entity';

type TaskBody = { id: string; title: string; status: string; assignee: string };
type ListBody = {
  data: TaskBody[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {    
    if (!process.env.DB_NAME?.endsWith('_test')) {
      throw new Error('Refusing to run e2e tests against a non-test database');
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
   
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(Task).clear();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  const createTask = async (body: Record<string, unknown>): Promise<TaskBody> => {
    const res = await request(server()).post('/tasks').send(body).expect(201);
    return res.body as TaskBody;
  };

  it('POST /tasks -> 400 when the body is invalid', async () => {
    await request(server())
      .post('/tasks')
      .send({ title: '', assignee: 'Ana', foo: 'bar' })
      .expect(400);
  });

  it('POST /tasks -> 201 and then GET /tasks/:id -> 200', async () => {
    const created = await createTask({ title: 'First task', assignee: 'Ana' });
    expect(created.status).toBe('pending'); 

    const res = await request(server()).get(`/tasks/${created.id}`).expect(200);
    expect((res.body as TaskBody).title).toBe('First task');
  });

  it('GET /tasks/:id -> 400 for a non-UUID id and 404 for an unknown id', async () => {
    await request(server()).get('/tasks/not-a-uuid').expect(400);
    await request(server())
      .get('/tasks/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /tasks -> filters by assignee and paginates', async () => {
    await createTask({ title: 'T1', assignee: 'Ana' });
    await createTask({ title: 'T2', assignee: 'Ana' });
    await createTask({ title: 'T3', assignee: 'Luis' });

    const filtered = await request(server()).get('/tasks?assignee=Ana').expect(200);
    expect((filtered.body as ListBody).meta.total).toBe(2);

    const page2 = await request(server()).get('/tasks?limit=2&page=2').expect(200);
    const body = page2.body as ListBody;
    expect(body.data).toHaveLength(1);
    expect(body.meta.totalPages).toBe(2);
  });

  it('GET /tasks -> 400 for an invalid status filter', async () => {
    await request(server()).get('/tasks?status=nope').expect(400);
  });

  it('PATCH then DELETE a task -> 200, 204 and finally 404', async () => {
    const created = await createTask({ title: 'To update', assignee: 'Ana' });

    const patched = await request(server())
      .patch(`/tasks/${created.id}`)
      .send({ status: 'in_progress' })
      .expect(200);
    expect((patched.body as TaskBody).status).toBe('in_progress');

    await request(server()).delete(`/tasks/${created.id}`).expect(204);
    await request(server()).get(`/tasks/${created.id}`).expect(404);
  });
});