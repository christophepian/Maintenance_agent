import * as http from 'http';

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
        expect(parsed).toHaveProperty('data');
        expect(parsed.data).toHaveProperty('autoApproveLimit');
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

  it('should create request without estimatedCost (POST /requests)', done => {
    const payload = JSON.stringify({
      description: 'Oven is overheating and smells hot',
      category: 'oven',
    });

    const req = http.request(
      `${BASE_URL}/requests`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          expect(res.statusCode).toBe(201);
          expect(() => JSON.parse(data)).not.toThrow();
          const parsed = JSON.parse(data);
          expect(parsed).toHaveProperty('data');
          expect(parsed.data).toHaveProperty('status');
          expect(parsed.data.status).toBe('PENDING_REVIEW');
          done();
        });
      }
    );

    req.on('error', err => {
      console.error('Connection error (server may not be running):', err.message);
      done(err);
    });

    req.write(payload);
    req.end();
  }, 10000);
});

