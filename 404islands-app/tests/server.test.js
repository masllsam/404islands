const request = require('supertest');
const app = require('../src/backend/server');

describe('backend server', () => {
  it('serves a banner on the root route', async () => {
    const res = await request(app).get('/');

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('404islands Backend is running!');
  });

  it('reports health without touching the database', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/no-such-route');

    expect(res.statusCode).toBe(404);
  });

  it('does not bind a port when imported', () => {
    // Importing the app must not start a listener, otherwise jest hangs.
    expect(app.listening).toBeUndefined();
  });
});
