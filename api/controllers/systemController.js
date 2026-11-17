// System & Settings Controller per SRS Section 6
const packageJson = require('../../package.json');

const startTime = Date.now();

function getSettings() {
  return {
    status: 'success',
    engine: {
      name: 'Bhairavshri Vedic Astrology Calculation Engine',
      version: packageJson.version || '1.1.15',
      author: 'SurfSync Infotech Pvt. Ltd.'
    },
    astrology_standards: {
      framework: 'Vedic / Parashari System',
      zodiac: 'Sidereal Zodiac',
      ayanamsa: 'Lahiri (Chitrapaksha) - Ephemeris Epoch JD 2435553.5',
      node_model: 'Mean Lunar Nodes (180° Ketu Axis)',
      house_system: 'Whole-sign (Rashi Bhavas)',
      dasha_system: 'Vimshottari 120-Year Sequence (365.2425 days/year)',
      nakshatra_divisions: '27 Nakshatras x 4 Padas (108 Navamsha padas)'
    },
    supported_calculation_profiles: [
      'vedic-lahiri-v1',
      'vedic-whole-sign-v1'
    ],
    supported_locales: ['en', 'hi'],
    timestamp: new Date().toISOString()
  };
}

function getHealth() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  return {
    status: 'UP',
    service: 'bhairavshri-astrology-api',
    uptime_seconds: uptimeSeconds,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    memory_usage_mb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2))
  };
}

module.exports = { getSettings, getHealth };
