// Kundli Controller: Core & Advanced Calculations per SRS Sections 4, 6.1 & 6.2
const jyotish = require('../../dist/index.js');

function calculateCore(parsed) {
  const { requestId, birthDate, observer, latitude, longitude, timezone, language, rawBirth } = parsed;

  const kundli = jyotish.getKundli(birthDate, observer, {
    ayanamsa: 'lahiri',
    houseSystem: 'whole_sign'
  });

  const asc = kundli.ascendant;
  const moon = kundli.planets.Moon;

  // Format planets array
  const planetsList = Object.entries(kundli.planets).map(([name, p]) => ({
    planet: name,
    sign: p.rashiName,
    sign_number: p.rashi,
    house: p.house,
    longitude_deg: Number(p.longitude.toFixed(4)),
    degree: p.degree,
    minute: p.minute,
    second: p.second,
    speed: p.speed ? Number(p.speed.toFixed(4)) : null,
    is_retrograde: p.isRetrograde || false,
    is_combust: p.isCombust || false,
    dignity: p.dignity || 'neutral',
    nakshatra: p.nakshatra,
    pada: p.pada,
    nakshatra_lord: p.nakshatraLord
  }));

  // Format houses array
  const housesList = kundli.houses.map(h => ({
    house_number: h.houseNumber,
    sign: h.rashiName,
    sign_number: h.rashi,
    lord: h.rashiLord,
    start_degree: Number(h.startLongitude.toFixed(2)),
    end_degree: Number(h.endLongitude.toFixed(2)),
    occupants: h.planets
  }));

  return {
    request_id: requestId,
    status: 'success',
    chart_id: 'chart-' + Math.abs(birthDate.getTime()).toString(16),
    calculation: {
      utc_instant: birthDate.toISOString(),
      local_time: rawBirth.local_time || birthDate.toLocaleTimeString('en-IN'),
      timezone: timezone,
      coordinates: { latitude, longitude },
      ayanamsa: 'lahiri',
      zodiac: 'sidereal',
      node_model: 'mean',
      engine_version: '1.1.15',
      rules_version: 'vedic-lahiri-v1'
    },
    lagna: {
      longitude_deg: Number(asc.longitude.toFixed(4)),
      sign: asc.rashiName,
      sign_number: asc.rashi,
      degree: asc.degree,
      minute: asc.minute,
      second: asc.second,
      lord: asc.rashiLord,
      nakshatra: asc.nakshatra,
      pada: asc.pada
    },
    moon: {
      rashi: moon.rashiName,
      rashi_number: moon.rashi,
      longitude_deg: Number(moon.longitude.toFixed(4)),
      nakshatra: moon.nakshatra,
      pada: moon.pada,
      nakshatra_lord: moon.nakshatraLord
    },
    planets: planetsList,
    houses: housesList,
    warnings: []
  };
}

function calculateAdvanced(parsed) {
  const { requestId, birthDate, observer, latitude, longitude, timezone, language, rawBirth } = parsed;

  const kundli = jyotish.getKundli(birthDate, observer, {
    ayanamsa: 'lahiri',
    houseSystem: 'whole_sign',
    includeChalit: true,
    includeKp: true,
    includeSpecialLagnas: true,
    includeArudhas: true,
    includeReferenceCharts: true
  });

  const lang = language || 'en';

  // 1. Dashas
  const dashaTree = kundli.dasha;
  const currentMaha = dashaTree.mahadashas[0] || null;

  // 2. Yogas & Doshas
  const yogasResult = jyotish.getYogasAndDoshas(kundli, { lang });

  // 3. Manglik Dosha
  const mangalResult = jyotish.checkMangalDosha(kundli, { lang });

  // 4. Shani Sade Sati & Dhaiya
  const transitDate = new Date();
  const transitKundli = jyotish.getKundli(transitDate, observer, { ayanamsa: 'lahiri', houseSystem: 'whole_sign' });
  const moonLon = kundli.planets.Moon.longitude;
  const saturnLon = transitKundli.planets.Saturn.longitude;
  const sadesati = jyotish.checkSadeSati(moonLon, saturnLon);
  const dhaiya = jyotish.checkDhaiya(moonLon, saturnLon);

  // 5. Graha Bala / Ashtakavarga
  const av = kundli.ashtakavarga || jyotish.getAshtakavarga(kundli);

  return {
    request_id: requestId,
    status: 'success',
    chart_id: 'chart-adv-' + Math.abs(birthDate.getTime()).toString(16),
    calculation: {
      utc_instant: birthDate.toISOString(),
      ayanamsa: 'lahiri',
      zodiac: 'sidereal',
      rules_version: 'vedic-lahiri-v1'
    },
    dashas: {
      system: 'Vimshottari 120-year',
      birthBalanceLord: dashaTree.balancePlanet || dashaTree.currentMahadasha || null,
      balanceYearsRemaining: dashaTree.balanceYears || null,
      currentMahadasha: currentMaha ? {
        planet: currentMaha.planet,
        start_date: currentMaha.startTime,
        end_date: currentMaha.endTime,
        antardashas: currentMaha.antars?.map(a => ({
          planet: a.planet,
          start_date: a.startTime,
          end_date: a.endTime
        }))
      } : null,
      mahadashaSequence: dashaTree.mahadashas?.map(m => ({
        planet: m.planet,
        start_date: m.startTime,
        end_date: m.endTime
      }))
    },
    yogas: {
      totalDetected: yogasResult.totalYogasDetected,
      rajaYogas: yogasResult.rajaYogas,
      dhanaYogas: yogasResult.dhanaYogas,
      mahapurushaYogas: yogasResult.mahapurushaYogas
    },
    doshas: {
      kemadrumaYoga: yogasResult.kemadrumaYoga,
      guruChandalYoga: yogasResult.guruChandalYoga,
      grahanYoga: yogasResult.grahanYoga
    },
    manglik: {
      hasDosha: mangalResult.hasDosha,
      isHigh: mangalResult.isHigh,
      status: mangalResult.hasDosha ? 'Active' : 'Cancelled / None',
      description: mangalResult.description
    },
    kaal_sarp: {
      hasDosha: yogasResult.kaalSarpDosha?.hasDosha || false,
      type: yogasResult.kaalSarpDosha?.type || 'None',
      axis: yogasResult.kaalSarpDosha?.direction || 'Direct',
      intensity: yogasResult.kaalSarpDosha?.intensity || 'None'
    },
    sade_sati: {
      status: sadesati.status,
      phase: sadesati.phase || 'Not Active',
      dhaiya_status: dhaiya.status,
      dhaiya_type: dhaiya.type || 'None'
    },
    graha_bala: {
      ashtakavargaSAV: {
        totalBindus: av.sav.totalBindus,
        strongestHouse: av.sav.strongestHouse,
        weakestHouse: av.sav.weakestHouse,
        housePoints: av.sav.housePoints
      }
    },
    warnings: []
  };
}

module.exports = { calculateCore, calculateAdvanced };
