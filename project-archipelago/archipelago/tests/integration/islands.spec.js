const request = require('supertest');
const express = require('express');
const islandRoutes = require('@/backend/api/islands');

const app = express();
app.use(express.json());
app.use('/islands', islandRoutes);

describe('Island API Endpoints', () => {
  it('should retrieve a list of all islands', async () => {
    const res = await request(app).get('/islands');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('should retrieve the details of a specific island', async () => {
    const res = await request(app).get('/islands/1');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('_id', 1);
  });

  it('should create a new event for a specific island', async () => {
    const res = await request(app)
      .post('/islands/1/events')
      .send({
        event_type: 'storm',
        description: 'A powerful storm passed over the island.',
        visual_impact: 'heavy_rain_and_wind',
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('island_id', '1');
  });

  it('should update the controllable parameters of a specific island', async () => {
    const res = await request(app)
      .put('/islands/1/controls')
      .send({
        weatherIntensity: 1.5,
        seasonLength: 1.2,
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.controls).toEqual({
      weatherIntensity: 1.5,
      seasonLength: 1.2,
    });
  });
});