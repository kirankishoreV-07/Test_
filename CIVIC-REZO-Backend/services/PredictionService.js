/**
 * PredictionService.js
 * Generates Predictive Environmental Impact Analysis using:
 * 1. Rule-based engine for numeric scores
 * 2. Google Gemini API for human-readable explanation text
 *
 * Called once at complaint submission time. Results stored in Supabase.
 * Admin dashboard simply reads the stored result — no repeat API calls.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getWeather } = require('./weather_service');

// ─── Rule-based scoring tables ────────────────────────────────────────────────

const CATEGORY_BASE_IMPACT = {
  flooding:          { score: 90, degradation: 70, days: 3 },
  sewage_overflow:   { score: 88, degradation: 65, days: 4 },
  water_issue:       { score: 80, degradation: 55, days: 5 },
  road_damage:       { score: 72, degradation: 50, days: 8 },
  pothole:           { score: 68, degradation: 45, days: 10 },
  traffic_signal:    { score: 75, degradation: 40, days: 6 },
  electricity:       { score: 70, degradation: 35, days: 7 },
  air_pollution:     { score: 65, degradation: 30, days: 14 },
  garbage:           { score: 58, degradation: 30, days: 12 },
  tree_issue:        { score: 50, degradation: 25, days: 15 },
  streetlight:       { score: 45, degradation: 20, days: 20 },
  broken_streetlight:{ score: 45, degradation: 20, days: 20 },
  noise_pollution:   { score: 35, degradation: 15, days: 30 },
  stray_animals:     { score: 40, degradation: 15, days: 20 },
  other:             { score: 50, degradation: 25, days: 14 },
};

const AREA_TYPE_MULTIPLIER = {
  near_school:    1.25,
  near_hospital:  1.30,
  low_lying:      1.35,
  residential:    1.10,
  commercial:     1.05,
  industrial:     0.95,
  default:        1.00,
};

const CATEGORY_KEY_RISKS = {
  flooding:          ['Property damage', 'Waterlogging', 'Disease spread', 'Traffic disruption'],
  sewage_overflow:   ['Water contamination', 'Public health risk', 'Groundwater pollution'],
  water_issue:       ['Water supply disruption', 'Contamination risk', 'Dehydration hazard'],
  road_damage:       ['Road accidents', 'Vehicle damage', 'Pedestrian injury', 'Higher repair cost'],
  pothole:           ['Road accidents', 'Vehicle damage', 'Water accumulation', 'Higher repair cost'],
  traffic_signal:    ['Road accidents', 'Traffic jams', 'Emergency vehicle delay'],
  electricity:       ['Fire hazard', 'Electrocution risk', 'Business disruption'],
  air_pollution:     ['Respiratory illness', 'Reduced visibility', 'Long-term health impact'],
  garbage:           ['Disease vector breeding', 'Odor nuisance', 'Groundwater contamination'],
  tree_issue:        ['Falling hazard', 'Traffic obstruction', 'Property damage'],
  streetlight:       ['Increased crime risk', 'Road accidents at night', 'Pedestrian safety'],
  broken_streetlight:['Increased crime risk', 'Road accidents at night', 'Pedestrian safety'],
  noise_pollution:   ['Health stress', 'Sleep disturbance', 'Reduced quality of life'],
  stray_animals:     ['Public safety risk', 'Disease transmission', 'Traffic accidents'],
  other:             ['Community disruption', 'Safety hazard', 'Quality of life impact'],
};

// ─── Helper: detect area type from address / description ─────────────────────

function detectAreaType(address = '', description = '') {
  const text = `${address} ${description}`.toLowerCase();
  if (text.includes('school') || text.includes('college'))   return 'near_school';
  if (text.includes('hospital') || text.includes('clinic'))  return 'near_hospital';
  if (text.includes('low') || text.includes('flood prone') || text.includes('waterlog')) return 'low_lying';
  if (text.includes('residential') || text.includes('nagar') || text.includes('colony')) return 'residential';
  if (text.includes('market') || text.includes('bazaar') || text.includes('mall'))       return 'commercial';
  if (text.includes('industrial') || text.includes('factory') || text.includes('plant')) return 'industrial';
  return 'default';
}

// ─── Rule-based engine ────────────────────────────────────────────────────────

function calculateRuleBasedScores({
  category,
  confidence,
  locationData,
  weatherData,
}) {
  const base = CATEGORY_BASE_IMPACT[category] || CATEGORY_BASE_IMPACT.other;

  // 1. Confidence modifier (+/- up to 10 pts)
  const confidenceModifier = Math.round((confidence - 0.5) * 20); // -10 to +10

  // 2. Area type multiplier
  const address     = locationData?.address || '';
  const description = locationData?.description || '';
  const areaType    = detectAreaType(address, description);
  const multiplier  = AREA_TYPE_MULTIPLIER[areaType] || 1.0;

  // 3. Rainfall risk modifier
  let rainfallModifier = 0;
  let rainfallNote = '';
  if (weatherData) {
    const today = weatherData.forecast?.[0];
    const tomorrow = weatherData.forecast?.[1];
    const maxRainProb = Math.max(
      today?.rainProbability || 0,
      tomorrow?.rainProbability || 0
    );
    const rainyCategories = ['flooding', 'road_damage', 'pothole', 'sewage_overflow', 'water_issue', 'garbage'];
    if (rainyCategories.includes(category)) {
      if (maxRainProb >= 70) { rainfallModifier = 12; rainfallNote = 'heavy rainfall expected'; }
      else if (maxRainProb >= 40) { rainfallModifier = 6; rainfallNote = 'moderate rain forecast'; }
      else if (maxRainProb >= 20) { rainfallModifier = 2; rainfallNote = 'light rain possible'; }
    }
  }

  // 4. Final scores (capped)
  const rawImpact    = Math.round((base.score + confidenceModifier + rainfallModifier) * multiplier);
  const impactScore  = Math.min(100, Math.max(0, rawImpact));
  const degradation  = Math.min(99, Math.round(base.degradation * multiplier + (rainfallModifier * 0.5)));
  const daysUntilCritical = Math.max(1, Math.round(base.days / multiplier));
  const keyRisks     = CATEGORY_KEY_RISKS[category] || CATEGORY_KEY_RISKS.other;

  return {
    impactScore,
    degradation,
    daysUntilCritical,
    keyRisks,
    areaType,
    rainfallNote,
    confidenceModifier,
    rainfallModifier,
    multiplier,
  };
}

// ─── Gemini text generation ───────────────────────────────────────────────────

async function generateGeminiExplanation({
  category,
  confidence,
  locationData,
  scores,
  weatherData,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY not set – using fallback prediction text.');
    return generateFallbackText({ category, confidence, locationData, scores });
  }

  try {
    const genAI  = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const locationText = locationData?.address || locationData?.description || 'Chennai';
    const forecastText = weatherData?.isHeavyRainExpected
      ? `Heavy rain is expected in the next 48 hours (${weatherData.forecast?.[0]?.rainProbability || 0}% probability).`
      : `Rain probability: today ${weatherData?.forecast?.[0]?.rainProbability || 0}%, tomorrow ${weatherData?.forecast?.[1]?.rainProbability || 0}%.`;

    const prompt = `
You are an expert civic environmental analyst for Chennai, India. Generate a concise, professional, 2-3 sentence environmental impact prediction for a newly submitted civic complaint.

Complaint Details:
- Issue Type: ${category.replace(/_/g, ' ')}
- AI Confidence: ${Math.round(confidence * 100)}%
- Location: ${locationText}
- Area Type: ${scores.areaType.replace(/_/g, ' ')}
- Environmental Impact Score: ${scores.impactScore}/100
- Estimated Degradation: ${scores.degradation}%
- Predicted Days Until Critical: ${scores.daysUntilCritical} days
- Key Risks: ${scores.keyRisks.join(', ')}
- Weather Context: ${forecastText}

Write a single, direct paragraph (2-3 sentences). Be specific about the location, timeframe, and risks. End with the Environmental Impact Score. Do NOT use bullet points or headers.
`.trim();

    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();
    console.log('✅ Gemini prediction text generated.');
    return text;
  } catch (err) {
    console.error('❌ Gemini API error:', err.message);
    return generateFallbackText({ category, confidence, locationData, scores });
  }
}

function generateFallbackText({ category, confidence, locationData, scores }) {
  const loc    = locationData?.address || 'the reported area';
  const cat    = category.replace(/_/g, ' ');
  const conf   = Math.round(confidence * 100);
  const rain   = scores.rainfallNote ? ` Combined with ${scores.rainfallNote}, this significantly accelerates the risk.` : '';
  return `This ${cat} issue (${conf}% confidence) in ${loc}, if unaddressed within ${scores.daysUntilCritical} days, risks reaching a critical state with an estimated ${scores.degradation}% degradation.${rain} Key risks include: ${scores.keyRisks.slice(0, 3).join(', ')}. Environmental Impact Score: ${scores.impactScore}/100.`;
}

// ─── Main exported function ───────────────────────────────────────────────────

async function generatePrediction({ category, confidence = 0.75, locationData, lat, lon }) {
  console.log(`🔮 Generating prediction for category=${category}, confidence=${confidence}`);

  // Fetch weather (reuses cached result if available)
  let weatherData = null;
  try {
    weatherData = await getWeather(lat || 13.0827, lon || 80.2707);
  } catch (e) {
    console.warn('⚠️ Weather fetch failed for prediction, continuing without it:', e.message);
  }

  // Rule-based scores
  const scores = calculateRuleBasedScores({ category, confidence, locationData, weatherData });

  // Gemini explanation
  const predictionText = await generateGeminiExplanation({
    category,
    confidence,
    locationData,
    scores,
    weatherData,
  });

  const result = {
    prediction_text: predictionText,
    environmental_impact_score: scores.impactScore,
    degradation_percentage: scores.degradation,
    predicted_days_until_critical: scores.daysUntilCritical,
    key_risks: scores.keyRisks,
  };

  console.log('✅ Prediction generated:', result);
  return result;
}

module.exports = { generatePrediction };
