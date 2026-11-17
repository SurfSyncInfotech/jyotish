// API Key Authentication Middleware per SRS Section 2.1 & 6.3

const VALID_API_KEYS = new Set([
  process.env.BHAIRAVSHRI_API_KEY || 'bhairavshri-api-key-2026',
  'test-key-authorized'
]);

function authenticate(req) {
  // Allow health and settings to be accessed without credentials if needed
  const url = req.url.split('?')[0];
  if (url.endsWith('/health') || url.endsWith('/details/settings')) {
    return { authorized: true };
  }

  const apiKey = req.headers['x-api-key'] || 
                 (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null);

  if (!apiKey) {
    return {
      authorized: false,
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Missing service credentials. Please provide a valid "x-api-key" header.'
    };
  }

  if (!VALID_API_KEYS.has(apiKey)) {
    return {
      authorized: false,
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Invalid service credentials provided.'
    };
  }

  return { authorized: true, apiKey };
}

module.exports = { authenticate, VALID_API_KEYS };
