const express = require('express');
const request = require('supertest');

global.logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
global.resBuilder = require('../../utils/ResponseBuilder');

const mockPostgres = {
  FormConditions: {
    entity: jest.fn(),
    entities: jest.fn(),
    create: jest.fn(),
  },
};
global.postgres = mockPostgres;

const formConditionsRouter = require('../../routes/formConditions');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', formConditionsRouter);
  return app;
}

const validPayload = {
  processId: 1,
  sourceFormId: 10,
  targetFormId: 20,
  fieldName: 'status',
  operator: 'eq',
  expectedValue: 'approved',
};

describe('POST /formConditions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new condition and returns 200', async () => {
    mockPostgres.FormConditions.entity.mockResolvedValue(null);
    mockPostgres.FormConditions.create.mockResolvedValue({ id: 1, ...validPayload });

    const res = await request(makeApp()).post('/').send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(mockPostgres.FormConditions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: 1,
        fieldName: 'status',
        expectedValue: 'approved',
      })
    );
  });

  it('updates an existing condition when one already exists', async () => {
    const existing = {
      ...validPayload,
      id: 5,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockPostgres.FormConditions.entity.mockResolvedValue(existing);

    const updated = { ...validPayload, fieldName: 'grade', operator: 'gt', expectedValue: '5' };
    const res = await request(makeApp()).post('/').send(updated);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(existing.save).toHaveBeenCalled();
    expect(existing.fieldName).toBe('grade');
    expect(existing.operator).toBe('gt');
    expect(mockPostgres.FormConditions.create).not.toHaveBeenCalled();
  });

  it('returns 400 when a required field is missing', async () => {
    const { fieldName, ...incomplete } = validPayload;
    const res = await request(makeApp()).post('/').send(incomplete);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
  });

  it('returns 400 when expectedValue is null', async () => {
    const res = await request(makeApp()).post('/').send({ ...validPayload, expectedValue: null });
    expect(res.status).toBe(400);
  });

  it('coerces numeric expectedValue to string', async () => {
    mockPostgres.FormConditions.entity.mockResolvedValue(null);
    mockPostgres.FormConditions.create.mockResolvedValue({ id: 2, ...validPayload, expectedValue: '42' });

    const res = await request(makeApp()).post('/').send({ ...validPayload, expectedValue: 42 });

    expect(res.status).toBe(200);
    expect(mockPostgres.FormConditions.create).toHaveBeenCalledWith(
      expect.objectContaining({ expectedValue: '42' })
    );
  });

  it('returns 500 when DB throws', async () => {
    mockPostgres.FormConditions.entity.mockRejectedValue(new Error('DB error'));

    const res = await request(makeApp()).post('/').send(validPayload);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

describe('GET /formConditions/:processId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns conditions for a process', async () => {
    const conditions = [{ id: 1, processId: 1 }, { id: 2, processId: 1 }];
    mockPostgres.FormConditions.entities.mockResolvedValue(conditions);

    const res = await request(makeApp()).get('/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(2);
    expect(mockPostgres.FormConditions.entities).toHaveBeenCalledWith({ processId: '1' });
  });

  it('returns empty array when no conditions exist', async () => {
    mockPostgres.FormConditions.entities.mockResolvedValue([]);

    const res = await request(makeApp()).get('/99');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when DB throws', async () => {
    mockPostgres.FormConditions.entities.mockRejectedValue(new Error('DB error'));

    const res = await request(makeApp()).get('/1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});
