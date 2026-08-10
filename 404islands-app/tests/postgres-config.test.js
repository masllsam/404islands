const { connectionManager } = require('../src/backend/database/postgres-config');

describe('postgres connection manager', () => {
  it('builds a sequelize connection from the environment', () => {
    const sequelize = connectionManager.getConnection();

    expect(sequelize).toBeDefined();
    expect(sequelize.getDialect()).toBe('postgres');
  });

  it('reports a failure instead of throwing when the database is unreachable', async () => {
    const sequelize = connectionManager.getConnection();
    jest
      .spyOn(sequelize, 'authenticate')
      .mockRejectedValue(new Error('connection refused'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await connectionManager.initialize();

    expect(result).toEqual({ success: false, error: 'connection refused' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
