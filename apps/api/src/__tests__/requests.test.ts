import http from 'http';

const BASE_URL = 'http://127.0.0.1:3001';

describe('Requests API Integration Tests', () => {
  it('should fetch requests list (GET /requests)', done => {
    http.get(`${BASE_URL}/requests`, res => {
      expect(res.statusCode).toBe(200);
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        expect(() => JSON.parse(data)).not.toThrow();
        const parsed = JSON.parse(data);
        expect(parsed).toHaveProperty('data');
        expect(Array.isArray(parsed.data)).toBe(true);
        done();
      });
    }).on('error', err => {
      console.error('Connection error (server may not be running):', err.message);
      done(err);
    });
  }, 10000);

  it('should return org config (GET /org-config)', done => {
    http.get(`${BASE_URL}/org-config`, res => {
      expect(res.statusCode).toBe(200);
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        expect(() => JSON.parse(data)).not.toThrow();
        const parsed = JSON.parse(data);
        expect(parsed).toHaveProperty('autoApproveLimit');
        done();
      });
    }).on('error', err => {
      console.error('Connection error (server may not be running):', err.message);
      done(err);
    });
  }, 10000);

  it('should list contractors (GET /contractors)', done => {
    http.get(`${BASE_URL}/contractors`, res => {
      expect(res.statusCode).toBe(200);
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        expect(() => JSON.parse(data)).not.toThrow();
        const parsed = JSON.parse(data);
        expect(parsed).toHaveProperty('data');
        expect(Array.isArray(parsed.data)).toBe(true);
        done();
      });
    }).on('error', err => {
      console.error('Connection error (server may not be running):', err.message);
      done(err);
    });
  }, 10000);
});

