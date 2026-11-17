const http = require('http');
const { handleApiRequest } = require('./api/routes');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  handleApiRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🌟 Bhairavshri Vedic Astrology API Server is RUNNING`);
  console.log(`  📍 Base URL: http://localhost:${PORT}/api/v1/astrology`);
  console.log(`  👉 Health check: http://localhost:${PORT}/api/v1/astrology/health`);
  console.log(`  👉 Settings: http://localhost:${PORT}/api/v1/astrology/details/settings`);
  console.log(`  🔑 Default API Key: bhairavshri-api-key-2026`);
  console.log(`=======================================================`);
});
