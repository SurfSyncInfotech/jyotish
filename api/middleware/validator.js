// Input Validation & Normalization Middleware per SRS Section 4 & 6.3
const { Observer } = require('../../dist/index.js');

function resolveTimezoneOffset(tzString) {
  if (!tzString) return '+05:30'; // default India Standard Time
  if (tzString.startsWith('+') || tzString.startsWith('-')) return tzString;

  const tzMap = {
    'Asia/Kolkata': '+05:30',
    'Asia/Calcutta': '+05:30',
    'UTC': '+00:00',
    'GMT': '+00:00',
    'America/New_York': '-05:00',
    'America/Los_Angeles': '-08:00',
    'Europe/London': '+00:00',
    'Asia/Dubai': '+04:00',
    'Asia/Singapore': '+08:00'
  };

  return tzMap[tzString] || '+05:30';
}

function parseAndValidateBirthInput(body) {
  const requestId = body.request_id || 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  // Extract fields whether provided inside body.birth or top-level body
  const birth = body.birth || body;

  // 1. Date & Time Validation
  let dateStr = birth.date || body.date;
  let timeStr = birth.local_time || birth.time || '12:00:00';
  let timezoneStr = birth.timezone || body.timezone || 'Asia/Kolkata';

  if (!dateStr) {
    const err = new Error('Birth date is required in "YYYY-MM-DD" format.');
    err.code = 'INVALID_BIRTH_INPUT';
    err.statusCode = 400;
    throw err;
  }

  let finalIsoString = '';
  if (dateStr.includes('T')) {
    // Already ISO string
    finalIsoString = dateStr;
  } else {
    // Format: YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      const err = new Error(`Invalid birth date format "${dateStr}". Expected YYYY-MM-DD.`);
      err.code = 'INVALID_BIRTH_INPUT';
      err.statusCode = 400;
      throw err;
    }

    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (!timeRegex.test(timeStr)) {
      const err = new Error(`Invalid local_time format "${timeStr}". Expected HH:mm:ss.`);
      err.code = 'INVALID_BIRTH_INPUT';
      err.statusCode = 400;
      throw err;
    }
    if (timeStr.length === 5) timeStr += ':00';

    const offset = resolveTimezoneOffset(timezoneStr);
    finalIsoString = `${dateStr}T${timeStr}${offset}`;
  }

  const birthDate = new Date(finalIsoString);
  if (isNaN(birthDate.getTime())) {
    const err = new Error(`Invalid or unresolvable date/time: "${finalIsoString}".`);
    err.code = 'INVALID_BIRTH_INPUT';
    err.statusCode = 400;
    throw err;
  }

  // 2. Latitude & Longitude Validation
  const lat = typeof birth.latitude === 'number' ? birth.latitude : parseFloat(birth.latitude);
  const lon = typeof birth.longitude === 'number' ? birth.longitude : parseFloat(birth.longitude);
  const alt = typeof birth.altitude === 'number' ? birth.altitude : 0;

  if (isNaN(lat) || lat < -90 || lat > 90) {
    const err = new Error(`Invalid latitude "${birth.latitude}". Must be a decimal number between -90 and 90.`);
    err.code = 'INVALID_BIRTH_INPUT';
    err.statusCode = 400;
    throw err;
  }

  if (isNaN(lon) || lon < -180 || lon > 180) {
    const err = new Error(`Invalid longitude "${birth.longitude}". Must be a decimal number between -180 and 180.`);
    err.code = 'INVALID_BIRTH_INPUT';
    err.statusCode = 400;
    throw err;
  }

  const observer = new Observer(lat, lon, alt);
  const language = (body.language === 'hi' || birth.language === 'hi') ? 'hi' : 'en';

  return {
    requestId,
    subjectRef: body.subject_ref || 'self',
    birthDate,
    observer,
    latitude: lat,
    longitude: lon,
    timezone: timezoneStr,
    placeName: birth.place_name || 'Unspecified',
    language,
    rawBirth: birth
  };
}

module.exports = { parseAndValidateBirthInput, resolveTimezoneOffset };
