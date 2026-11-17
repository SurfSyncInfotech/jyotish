// Predictions Controller per SRS Section 5 & 5.1
const jyotish = require('../../dist/index.js');

function generatePredictions(parsed, body) {
  const { requestId, birthDate, observer, language } = parsed;
  const lang = language || 'en';

  const kundli = jyotish.getKundli(birthDate, observer, {
    ayanamsa: 'lahiri',
    houseSystem: 'whole_sign',
    includeChalit: true,
    includeKp: true,
    includeSpecialLagnas: true,
    includeArudhas: true,
    includeReferenceCharts: true
  });

  const asOf = body.as_of ? new Date(body.as_of) : new Date();

  // 1. Run Core Prediction Engines
  const career = jyotish.getCareerPrediction(kundli, { lang });
  const wealth = jyotish.getWealthPrediction(kundli, { lang });
  const marriage = jyotish.getMarriagePrediction(kundli, { asOf, lang });
  const health = jyotish.getHealthPrediction(kundli, { lang });
  const education = jyotish.getEducationPrediction(kundli, { lang });
  const dashaTimeline = jyotish.getDashaTimelinePrediction(kundli, { asOf, lang });
  const transits = jyotish.getTransitPredictions(kundli, { asOf, lang });
  const remedies = jyotish.getRemedies(kundli, { lang });
  const gemstones = jyotish.getGemstoneRecommendation(kundli, { asOf, lang, userWeightKg: body.user_weight_kg || 70 });

  const disclaimer = lang === 'hi' 
    ? 'यह फलकथन पारंपरिक वैदिक ज्योतिष सिद्धांतों और ग्रह गणनाओं पर आधारित है। यह कोई वैज्ञानिक या कानूनी गारंटी नहीं है।'
    : 'Astrological predictions are traditional rule-based interpretations and not scientific or legal guarantees.';

  const ruleVersion = 'bphs-parashari-v1.1';

  // 2. Format 9 SRS Required Categories (SRS-FR-020 to SRS-FR-030)
  const predictions = {
    // 1. Career
    career: {
      category: 'Career & Profession',
      summary: career.recommendation,
      factors: {
        tenthHouseLord: career.tenthLordPlacementResult,
        amatyakarakaPlanet: career.amatyakarakaInsight,
        governmentJobLikelihood: career.governmentJobLikelihood?.likelihood || 'Moderate',
        governmentJobScore: career.governmentJobLikelihood?.score || 50,
        primaryCareerFields: career.primaryCareerFields || []
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 2. Business
    business: {
      category: 'Business & Entrepreneurship',
      summary: `Business Suitability Score: ${career.businessScore}/100 vs Job: ${career.jobScore}/100`,
      factors: {
        businessScore: career.businessScore,
        jobScore: career.jobScore,
        mercuryRole: 'Mercury & 7th/10th/11th house coordination',
        recommendation: career.jobScore > career.businessScore ? 'Job / Service preferred' : 'Business / Self-employment preferred'
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 3. Finance & Wealth
    finance: {
      category: 'Finance & Wealth',
      summary: `Wealth Rating: ${wealth.wealthRating} (Income Potential: ${wealth.incomePotential}/100)`,
      factors: {
        induLagna: wealth.induLagnaInsight,
        dhanaYogasDetected: wealth.dhanaYogas?.length || 0,
        dhanaYogas: wealth.dhanaYogas || [],
        secondLordPlacement: wealth.secondLordPlacementResult,
        eleventhLordPlacement: wealth.eleventhLordPlacementResult
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 4. Marriage
    marriage: {
      category: 'Marriage & Relationships',
      summary: `Marriage Type Recommendation: ${marriage.marriageType?.recommendation || 'Harmonious'}`,
      factors: {
        favorableAgeRange: marriage.favorableAgeRange,
        candidateTimingYears: marriage.predictedTimingYears || [],
        spouseAgeDifference: marriage.spouseAgeDifference?.relativeAge,
        upapadaLagnaInsight: marriage.upapadaLagnaInsight,
        delayFactors: marriage.vivahaVilambaFactors?.causes || []
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 5. Education
    education: {
      category: 'Education & Intellect',
      summary: `Intellect Rating: ${education.intellectRating} (Academic Score: ${education.academicSuccessScore}/100)`,
      factors: {
        academicSuccessScore: education.academicSuccessScore,
        competitiveExamsLikelihood: education.competitiveExams?.successLikelihood,
        recommendedStreams: education.recommendedStreams?.map(s => s.stream) || []
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 6. Property & Real Estate
    property: {
      category: 'Property & Real Estate',
      summary: `Property Acquisition Potential: ${wealth.propertyAndRealEstate?.potential || 'Favorable'}`,
      factors: {
        fourthHouseAssessment: '4th House & Mars/Saturn evaluation',
        propertyPotential: wealth.propertyAndRealEstate?.potential || 'Good',
        details: wealth.propertyAndRealEstate?.recommendation || 'Supported by 4th house and Mars aspects.'
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 7. Foreign Travel & Relocation
    foreign_travel: {
      category: 'Foreign Travel & Settlement',
      summary: education.foreignStudy?.isSupported 
        ? (lang === 'hi' ? 'विदेश यात्रा / विदेशी संबंध अनुकूल हैं' : 'Foreign travel and global relocation are astrologically supported')
        : (lang === 'hi' ? 'मध्यम विदेशी अवसर' : 'Moderate foreign travel indications'),
      factors: {
        ninthAndTwelfthHouse: '9th House (Long Journeys) & 12th House (Foreign Lands)',
        foreignEducationSupported: education.foreignStudy?.isSupported || false,
        score: education.foreignStudy?.score || 55
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 8. Dasha Explanation
    dasha_prediction: {
      category: 'Vimshottari Dasha Analysis',
      summary: `Active Mahadasha: ${dashaTimeline.currentMahadasha?.planet} - Antardasha: ${dashaTimeline.currentAntardasha?.planet}`,
      factors: {
        currentMahadasha: dashaTimeline.currentMahadasha,
        currentAntardasha: dashaTimeline.currentAntardasha,
        careerPeriodTheme: dashaTimeline.currentPeriodThemes?.career,
        financialPeriodTheme: dashaTimeline.currentPeriodThemes?.finance,
        generalPeriodTheme: dashaTimeline.currentPeriodThemes?.general
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 9. Gochar / Transit Explanation
    gochar_prediction: {
      category: 'Gochara Planetary Transits',
      summary: transits.summary,
      factors: {
        overallScore: transits.overallTransitScore,
        saturnTransit: transits.saturnTransit,
        jupiterTransit: transits.jupiterTransit,
        rahuKetuAxis: transits.rahuKetuAxis
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    },

    // 10. Remedies
    remedies: {
      category: 'Traditional Vedic & Gemstone Remedies',
      summary: lang === 'hi' ? 'दोष निवारण एवं ग्रह शांति उपाय' : 'Vedic Remedies & Planetary Harmonization',
      factors: {
        gemstones: {
          recommended: gemstones.recommendedStones?.map(g => ({
            name: g.gemstoneName,
            hindiName: g.gemstoneHindiName,
            planet: g.planet,
            suitability: g.suitability,
            specifications: g.specifications
          })),
          conditional: gemstones.conditionalStones?.map(g => ({
            name: g.gemstoneName,
            planet: g.planet,
            applicableDasha: g.timing?.applicableDasha,
            wearingWindow: g.timing?.wearingWindowEn || g.timing?.wearingWindowHi
          })),
          prohibited: gemstones.prohibitedStones?.map(g => ({
            name: g.gemstoneName,
            planet: g.planet,
            reason: g.reason
          }))
        },
        mantras: remedies.mantras || [],
        charityAndDonation: remedies.donations || remedies.charity || [],
        fastingDays: remedies.fasting || []
      },
      content_locale: lang,
      rule_version: ruleVersion,
      caution_disclaimer: disclaimer
    }
  };

  return {
    request_id: requestId,
    status: 'success',
    calculation: {
      as_of: asOf.toISOString(),
      natal_utc: birthDate.toISOString(),
      ayanamsa: 'lahiri',
      rules_version: ruleVersion
    },
    predictions: predictions
  };
}

module.exports = { generatePredictions };
