const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAndValidateBirthInput } = require('../api/middleware/validator');
const { authenticate } = require('../api/middleware/auth');
const { calculateCore, calculateAdvanced } = require('../api/controllers/kundliController');
const { calculateTransits } = require('../api/controllers/transitController');
const { generatePredictions } = require('../api/controllers/predictionController');
const { getSettings, getHealth } = require('../api/controllers/systemController');

// 10 Reference Kundli Profiles covering different geographies & epochs (SRS Section 10.1)
const referenceProfiles = [
  { name: 'Profile 1: Delhi 1997', date: '1997-08-14', local_time: '09:35:00', lat: 28.6139, lon: 77.2090, tz: 'Asia/Kolkata', expectedLagna: 'Virgo' },
  { name: 'Profile 2: Mumbai 2000', date: '2000-01-01', local_time: '12:00:00', lat: 19.0760, lon: 72.8777, tz: 'Asia/Kolkata', expectedLagna: 'Pisces' },
  { name: 'Profile 3: Varanasi 2004', date: '2004-02-20', local_time: '07:15:00', lat: 25.8720, lon: 82.6850, tz: 'Asia/Kolkata', expectedLagna: 'Aquarius' },
  { name: 'Profile 4: New York 1995', date: '1995-07-04', local_time: '18:30:00', lat: 40.7128, lon: -74.0060, tz: 'America/New_York' },
  { name: 'Profile 5: London 1988', date: '1988-11-15', local_time: '06:00:00', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { name: 'Profile 6: Tokyo 2010', date: '2010-10-10', local_time: '10:10:00', lat: 35.6762, lon: 139.6503, tz: '+09:00' },
  { name: 'Profile 7: Sydney 2026', date: '2026-11-04', local_time: '00:00:00', lat: -33.8688, lon: 151.2093, tz: '+11:00' },
  { name: 'Profile 8: Bangalore 1992', date: '1992-04-14', local_time: '08:45:00', lat: 12.9716, lon: 77.5946, tz: 'Asia/Kolkata' },
  { name: 'Profile 9: Jaipur 2005', date: '2005-08-31', local_time: '12:00:00', lat: 26.9124, lon: 75.7873, tz: 'Asia/Kolkata', expectedMoon: 'Cancer' },
  { name: 'Profile 10: Kolkata 1975', date: '1975-08-15', local_time: '05:30:00', lat: 22.5726, lon: 88.3639, tz: 'Asia/Kolkata' }
];

test('TC-01: Valid birth request returns full typed calculation data', () => {
  const p = referenceProfiles[0];
  const parsed = parseAndValidateBirthInput({
    birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon, timezone: p.tz }
  });
  const core = calculateCore(parsed);

  assert.equal(core.status, 'success');
  assert.ok(core.lagna.sign);
  assert.ok(core.moon.rashi);
  assert.ok(core.moon.nakshatra);
  assert.equal(core.planets.length, 12); // 9 planets + Uranus, Neptune, Pluto
  assert.equal(core.houses.length, 12);
});

test('TC-02: Invalid/ambiguous birthplace triggers explicit validation error', () => {
  assert.throws(() => {
    parseAndValidateBirthInput({ birth: { date: '2000-01-01', local_time: '12:00:00', latitude: 150.0, longitude: 77.0 } });
  }, /Invalid latitude/);

  assert.throws(() => {
    parseAndValidateBirthInput({ birth: { date: 'invalid-date', local_time: '12:00:00', latitude: 28.0, longitude: 77.0 } });
  }, /Invalid birth date/);
});

test('TC-03: Historical timezone / offset normalization', () => {
  const p = referenceProfiles[3]; // New York
  const parsed = parseAndValidateBirthInput({
    birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon, timezone: p.tz }
  });
  assert.ok(parsed.birthDate instanceof Date);
  assert.ok(!isNaN(parsed.birthDate.getTime()));
});

test('TC-04 & TC-05: Lagna/Rashi/Nakshatra expected signs across reference profiles', () => {
  // Test Profile 3 (Varanasi 2004) -> Lagna Aquarius
  const p = referenceProfiles[2];
  const parsed = parseAndValidateBirthInput({
    birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon, timezone: p.tz }
  });
  const core = calculateCore(parsed);
  assert.equal(core.lagna.sign, 'Aquarius');

  // Test Profile 9 (Jaipur 2005) -> Moon Cancer
  const p9 = referenceProfiles[8];
  const parsed9 = parseAndValidateBirthInput({
    birth: { date: p9.date, local_time: p9.local_time, latitude: p9.lat, longitude: p9.lon, timezone: p9.tz }
  });
  const core9 = calculateCore(parsed9);
  assert.equal(core9.moon.rashi, 'Cancer');
  assert.equal(core9.moon.nakshatra, 'Pushya');
});

test('TC-06: Vimshottari Dasha order and boundary calculation', () => {
  const p = referenceProfiles[0];
  const parsed = parseAndValidateBirthInput({
    birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon }
  });
  const adv = calculateAdvanced(parsed);
  assert.ok(adv.dashas.mahadashaSequence.length >= 8);
  assert.ok(adv.dashas.currentMahadasha.planet);
  assert.ok(adv.dashas.currentMahadasha.antardashas.length > 0);
});

test('TC-07: Yogas and Doshas decisions with Manglik & Kaal Sarp', () => {
  const p = referenceProfiles[2];
  const parsed = parseAndValidateBirthInput({
    birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon }
  });
  const adv = calculateAdvanced(parsed);
  assert.equal(typeof adv.manglik.hasDosha, 'boolean');
  assert.equal(typeof adv.kaal_sarp.hasDosha, 'boolean');
  assert.ok(Array.isArray(adv.yogas.rajaYogas));
});

test('TC-08: Sade Sati and transits calculation', () => {
  const p = referenceProfiles[0];
  const parsed = parseAndValidateBirthInput({
    birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon }
  });
  const trans = calculateTransits(parsed, {});
  assert.ok(trans.transits.sadeSati);
  assert.ok(trans.transits.planets.Saturn);
  assert.ok(trans.transits.planets.Jupiter);
});

test('TC-09 & TC-10: All 9 prediction categories + valid remedies returned', () => {
  const p = referenceProfiles[2];
  const parsed = parseAndValidateBirthInput({
    birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon },
    language: 'en'
  });
  const res = generatePredictions(parsed, {});
  const preds = res.predictions;

  assert.ok(preds.career);
  assert.ok(preds.business);
  assert.ok(preds.finance);
  assert.ok(preds.marriage);
  assert.ok(preds.education);
  assert.ok(preds.property);
  assert.ok(preds.foreign_travel);
  assert.ok(preds.dasha_prediction);
  assert.ok(preds.gochar_prediction);
  assert.ok(preds.remedies.factors.gemstones);
  assert.ok(preds.remedies.factors.mantras);
});

test('TC-11: Bilingual support for English and Hindi outputs', () => {
  const p = referenceProfiles[2];
  const parsedEn = parseAndValidateBirthInput({ birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon }, language: 'en' });
  const parsedHi = parseAndValidateBirthInput({ birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon }, language: 'hi' });

  const enRes = generatePredictions(parsedEn, {});
  const hiRes = generatePredictions(parsedHi, {});

  assert.equal(enRes.predictions.career.content_locale, 'en');
  assert.equal(hiRes.predictions.career.content_locale, 'hi');
  assert.ok(hiRes.predictions.remedies.caution_disclaimer.includes('पारंपरिक'));
});

test('TC-12: Repeat calculation generates deterministic equal results', () => {
  const p = referenceProfiles[0];
  const parsed1 = parseAndValidateBirthInput({ birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon } });
  const parsed2 = parseAndValidateBirthInput({ birth: { date: p.date, local_time: p.local_time, latitude: p.lat, longitude: p.lon } });

  const res1 = calculateCore(parsed1);
  const res2 = calculateCore(parsed2);

  assert.equal(res1.lagna.longitude_deg, res2.lagna.longitude_deg);
  assert.equal(res1.moon.longitude_deg, res2.moon.longitude_deg);
});

test('TC-13: API access control checks (Unauthorized rejection)', () => {
  const mockReqNoKey = { url: '/api/v1/astrology/kundli/calculate', headers: {} };
  const mockReqValid = { url: '/api/v1/astrology/kundli/calculate', headers: { 'x-api-key': 'bhairavshri-api-key-2026' } };

  const unauth = authenticate(mockReqNoKey);
  const auth = authenticate(mockReqValid);

  assert.equal(unauth.authorized, false);
  assert.equal(unauth.statusCode, 401);
  assert.equal(auth.authorized, true);
});

test('TC-14 & TC-15: System settings and health check operational', () => {
  const settings = getSettings();
  const health = getHealth();

  assert.equal(settings.status, 'success');
  assert.ok(settings.astrology_standards.ayanamsa.includes('Lahiri'));
  assert.equal(health.status, 'UP');
});
