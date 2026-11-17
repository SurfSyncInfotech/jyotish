// Main Router & Request Dispatcher per SRS Section 6
const url = require('url');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('./middleware/auth');
const { parseAndValidateBirthInput } = require('./middleware/validator');
const { calculateCore, calculateAdvanced } = require('./controllers/kundliController');
const { calculateTransits } = require('./controllers/transitController');
const { generatePredictions } = require('./controllers/predictionController');
const { getSettings, getHealth } = require('./controllers/systemController');

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        if (!body || body.trim() === '') {
          resolve({});
        } else {
          resolve(JSON.parse(body));
        }
      } catch (err) {
        const error = new Error('Malformed JSON payload: ' + err.message);
        error.code = 'INVALID_BIRTH_INPUT';
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', err => reject(err));
  });
}

function sendResponse(res, statusCode, data) {
  const payload = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
  });
  res.end(payload);
}

async function handleApiRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  // 1. Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
    });
    return res.end();
  }

  // 2. Postman Collection & Root Catalog
  if (method === 'GET' && (pathname === '/collection.json' || pathname === '/postman' || pathname === '/api/v1/astrology/postman')) {
    const colPath = path.join(__dirname, '../bhairavshri_api_postman_collection.json');
    if (fs.existsSync(colPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(fs.readFileSync(colPath, 'utf8'));
    }
  }

  // 3. Health Checks
  if (method === 'GET' && (pathname === '/health' || pathname === '/api/health' || pathname === '/api/v1/astrology/health')) {
    return sendResponse(res, 200, getHealth());
  }

  // 4. Settings & Engine Details
  if (method === 'GET' && (pathname === '/details/settings' || pathname === '/api/v1/astrology/details/settings')) {
    return sendResponse(res, 200, getSettings());
  }

  // 5. Welcome Index
  if (pathname === '/' || pathname === '/api/v1/astrology') {
    return sendResponse(res, 200, {
      service: 'Bhairavshri In-House Vedic Astrology Calculation & Prediction API',
      status: 'OPERATIONAL',
      documentation: 'Import /collection.json in Postman to test all endpoints',
      endpoints: {
        'POST /api/v1/astrology/kundli/calculate': 'Core Kundli (Lagna, Rashi, 9 Planets, 12 Houses, Nakshatras)',
        'POST /api/v1/astrology/kundli/advanced': 'Advanced Dasha, Yogas, Doshas, Manglik, Kaal Sarp, Sade Sati',
        'POST /api/v1/astrology/transits/calculate': 'Gochar Planetary Transits & Sade Sati phases',
        'POST /api/v1/astrology/predictions/generate': '9 Traditional Life Predictions & Vedic Remedies',
        'GET /api/v1/astrology/details/settings': 'Astrological calculation standards and engine version',
        'GET /api/v1/astrology/health': 'Service health status'
      }
    });
  }

  // 6. Authentication Check for Calculation Endpoints
  const auth = authenticate(req);
  if (!auth.authorized) {
    return sendResponse(res, auth.statusCode, {
      status: 'error',
      code: auth.code,
      message: auth.message
    });
  }

  // 7. Route Dispatcher for POST Calculation Endpoints
  if (method !== 'POST') {
    return sendResponse(res, 405, {
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP ${method} is not supported for ${pathname}. Use POST.`
    });
  }

  try {
    const body = await parseJsonBody(req);
    const parsedBirth = parseAndValidateBirthInput(body);

    // Route 1: Core Kundli
    if (pathname === '/kundli/calculate' || pathname === '/api/v1/astrology/kundli/calculate' || pathname === '/api/kundli') {
      const data = calculateCore(parsedBirth);
      return sendResponse(res, 200, data);
    }

    // Route 2: Advanced Kundli
    if (pathname === '/kundli/advanced' || pathname === '/api/v1/astrology/kundli/advanced') {
      const data = calculateAdvanced(parsedBirth);
      return sendResponse(res, 200, data);
    }

    // Route 3: Transits / Gochar
    if (pathname === '/transits/calculate' || pathname === '/api/v1/astrology/transits/calculate' || pathname === '/api/transits') {
      const data = calculateTransits(parsedBirth, body);
      return sendResponse(res, 200, data);
    }

    // Route 4: Predictions
    if (pathname === '/predictions/generate' || pathname === '/api/v1/astrology/predictions/generate' || pathname === '/api/predictions') {
      const data = generatePredictions(parsedBirth, body);
      return sendResponse(res, 200, data);
    }

    return sendResponse(res, 404, {
      status: 'error',
      code: 'ENDPOINT_NOT_FOUND',
      message: `Unknown endpoint: ${pathname}`
    });

  } catch (err) {
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || 'INTERNAL_ERROR';
    console.error(`[API Error ${statusCode}]`, err.message);

    return sendResponse(res, statusCode, {
      status: 'error',
      code: errorCode,
      message: err.message || 'An unexpected error occurred during calculation.'
    });
  }
}

module.exports = { handleApiRequest };
