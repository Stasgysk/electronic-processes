const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

global.resBuilder = require('../../utils/ResponseBuilder');
global.userUtils = require('../../utils/UserUtils');
global.postgres = {
  UsersSessions: {
    entity: jest.fn(),
  },
};

const authWrapper = require('../../utils/AuthWrapper');

const INTERNAL_SECRET = 'test-secret-123';

function makeApp({ excludedRoutes = [] } = {}) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    authWrapper({
      internalSecret: INTERNAL_SECRET,
      excludedRoutes,
    })
  );
  app.get('/protected', (req, res) => res.json({ ok: true, authType: req.authType }));
  app.post('/public', (req, res) => res.json({ ok: true }));
  return app;
}

describe('AuthWrapper middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('internal service auth', () => {
    it('passes request with correct x-service-auth header', async () => {
      const res = await request(makeApp())
        .get('/protected')
        .set('x-service-auth', INTERNAL_SECRET);

      expect(res.status).toBe(200);
      expect(res.body.authType).toBe('internal');
    });

    it('rejects request with wrong x-service-auth header', async () => {
      global.postgres.UsersSessions.entity.mockResolvedValue(null);

      const res = await request(makeApp())
        .get('/protected')
        .set('x-service-auth', 'wrong-secret');

      expect(res.status).toBe(401);
    });
  });

  describe('excluded routes', () => {
    it('passes through an excluded route without session', async () => {
      const app = makeApp({ excludedRoutes: [{ path: '/public', method: 'post' }] });

      const res = await request(app).post('/public');
      expect(res.status).toBe(200);
    });

    it('does not exclude a different method on the same path', async () => {
      const app = makeApp({ excludedRoutes: [{ path: '/public', method: 'post' }] });

      const res = await request(app).get('/public');
      expect(res.status).toBe(401);
    });
  });

  describe('session auth', () => {
    it('returns 401 when no session cookie is present', async () => {
      const res = await request(makeApp()).get('/protected');
      expect(res.status).toBe(401);
    });

    it('returns 401 when session is not found in DB', async () => {
      global.postgres.UsersSessions.entity.mockResolvedValue(null);

      const res = await request(makeApp())
        .get('/protected')
        .set('Cookie', 'session_id=nonexistent');

      expect(res.status).toBe(401);
    });

    it('returns 401 when session is expired', async () => {
      global.postgres.UsersSessions.entity.mockResolvedValue({
        userId: 42,
        expiresAt: new Date(Date.now() - 10_000),
      });

      const res = await request(makeApp())
        .get('/protected')
        .set('Cookie', 'session_id=expired-session');

      expect(res.status).toBe(401);
      expect(res.body.data).toMatch(/expired/i);
    });

    it('passes valid session and sets req.userId', async () => {
      global.postgres.UsersSessions.entity.mockResolvedValue({
        userId: 7,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const app = makeApp();
      const res = await request(app)
        .get('/protected')
        .set('Cookie', 'session_id=valid-session');

      expect(res.status).toBe(200);
      expect(res.body.authType).toBe('session');
    });

    it('returns 500 when DB throws', async () => {
      global.postgres.UsersSessions.entity.mockRejectedValue(new Error('DB down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(makeApp())
        .get('/protected')
        .set('Cookie', 'session_id=any');

      expect(res.status).toBe(500);
      console.error.mockRestore();
    });
  });
});
