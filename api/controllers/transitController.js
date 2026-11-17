// Transit / Gochar Controller per SRS Section 4 (SRS-FR-019, SRS-FR-028) & Section 6
const jyotish = require('../../dist/index.js');

function calculateTransits(parsed, body) {
  const { requestId, birthDate, observer, language } = parsed;

  const transitInstantStr = body.transit_datetime || body.transitDate || new Date().toISOString();
  const transitDate = new Date(transitInstantStr);
  if (isNaN(transitDate.getTime())) {
    const err = new Error(`Invalid transit_datetime "${transitInstantStr}". Expected ISO 8601 string.`);
    err.code = 'INVALID_TRANSIT_INPUT';
    err.statusCode = 400;
    throw err;
  }

  // 1. Natal Kundli
  const natalKundli = jyotish.getKundli(birthDate, observer, {
    ayanamsa: 'lahiri',
    houseSystem: 'whole_sign'
  });

  // 2. Transit Kundli at transit date
  const transitKundli = jyotish.getKundli(transitDate, observer, {
    ayanamsa: 'lahiri',
    houseSystem: 'whole_sign'
  });

  // 3. Comprehensive Gochar Analysis
  const gochar = jyotish.getGocharAnalysis 
    ? jyotish.getGocharAnalysis(natalKundli, transitDate) 
    : jyotish.getTransitPredictions(natalKundli, { asOf: transitDate, lang: language });

  // 4. Sade Sati & Dhaiya at transit instant
  const moonLon = natalKundli.planets.Moon.longitude;
  const saturnLon = transitKundli.planets.Saturn.longitude;
  const sadesati = jyotish.checkSadeSati(moonLon, saturnLon);
  const dhaiya = jyotish.checkDhaiya(moonLon, saturnLon);

  // 5. Format 9 Grahas Transit Positions
  const planetsTransit = {};
  const targetPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

  for (const p of targetPlanets) {
    const tPos = transitKundli.planets[p];
    if (tPos) {
      let houseFromMoon = Math.floor(tPos.longitude / 30) - Math.floor(moonLon / 30) + 1;
      if (houseFromMoon <= 0) houseFromMoon += 12;

      planetsTransit[p] = {
        sign: tPos.rashiName,
        sign_number: tPos.rashi,
        degree: tPos.degree,
        minute: tPos.minute,
        longitude_deg: Number(tPos.longitude.toFixed(4)),
        houseFromMoon: houseFromMoon,
        is_retrograde: tPos.isRetrograde || false
      };
    }
  }

  return {
    request_id: requestId,
    status: 'success',
    calculation: {
      transit_utc_instant: transitDate.toISOString(),
      natal_utc_instant: birthDate.toISOString(),
      ayanamsa: 'lahiri',
      rules_version: 'vedic-lahiri-v1'
    },
    transits: {
      overallVerdict: gochar.overallVerdict || 'Moderate',
      favorablePercentage: gochar.overallFavorablePercentage || null,
      sadeSati: {
        status: sadesati.status,
        phase: sadesati.phase || 'None',
        description: sadesati.status ? `Shani Sade Sati active (${sadesati.phase})` : 'No Sade Sati active'
      },
      dhaiya: {
        status: dhaiya.status,
        type: dhaiya.type || 'None'
      },
      guruGochar: gochar.specialTransits?.guruGochar || null,
      planets: planetsTransit,
      lifeAreas: gochar.lifeAreas || {}
    },
    warnings: []
  };
}

module.exports = { calculateTransits };
