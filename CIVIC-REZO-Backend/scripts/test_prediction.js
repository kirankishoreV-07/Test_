/**
 * test_prediction.js
 * Comprehensive test for the Predictive Environmental Impact Analysis system.
 * Tests:
 *   1. PredictionService rule-based logic (all categories)
 *   2. Gemini API connection (if key is set)
 *   3. Full HTTP POST /api/complaints/submit → prediction stored in Supabase
 *   4. Verify Supabase read-back of stored prediction
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { generatePrediction } = require('../services/PredictionService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BASE_URL = 'http://localhost:3001';
const DIVIDER = '─'.repeat(60);

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ PASS: ${label}`);
  passed++;
}
function fail(label, detail) {
  console.log(`  ❌ FAIL: ${label}`);
  if (detail) console.log(`         → ${detail}`);
  failed++;
}
function section(title) {
  console.log(`\n${DIVIDER}`);
  console.log(`📋 ${title}`);
  console.log(DIVIDER);
}

// ─── TEST 1: Rule-based scoring ────────────────────────────────────────────────
async function testRuleBasedLogic() {
  section('TEST 1 — Rule-Based Scoring (no Gemini, no network)');

  // Temporarily override GEMINI_API_KEY to force fallback
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const testCases = [
    {
      label: 'Pothole near school → high impact + area multiplier',
      input: { category: 'pothole', confidence: 0.87, locationData: { address: 'Velachery near school, Chennai', description: 'near school' } },
      checks: (r) => {
        if (r.environmental_impact_score > 60) ok('Impact score > 60 for pothole near school');
        else fail('Impact score too low', `got ${r.environmental_impact_score}`);
        if (r.predicted_days_until_critical <= 10) ok('Days until critical ≤ 10');
        else fail('Days too high', `got ${r.predicted_days_until_critical}`);
        if (r.key_risks.length > 0) ok('Key risks array is populated');
        else fail('Key risks empty');
        if (r.prediction_text && r.prediction_text.length > 30) ok('Fallback prediction text generated');
        else fail('prediction_text is empty or too short');
      }
    },
    {
      label: 'Flooding → critical impact',
      input: { category: 'flooding', confidence: 0.92, locationData: { address: 'T. Nagar, Chennai', description: 'low-lying area' } },
      checks: (r) => {
        if (r.environmental_impact_score >= 80) ok('Flooding impact score ≥ 80');
        else fail('Flooding impact too low', `got ${r.environmental_impact_score}`);
        if (r.predicted_days_until_critical <= 5) ok('Days until critical ≤ 5 for flooding');
        else fail('Days too high for flooding', `got ${r.predicted_days_until_critical}`);
      }
    },
    {
      label: 'Low confidence (0.4) → lower score',
      input: { category: 'garbage', confidence: 0.40, locationData: { address: 'Adyar, Chennai' } },
      checks: (r) => {
        if (r.environmental_impact_score < 70) ok('Lower confidence reduces impact score');
        else fail('Score too high for low-confidence', `got ${r.environmental_impact_score}`);
      }
    },
    {
      label: 'All 5 output fields present',
      input: { category: 'road_damage', confidence: 0.75, locationData: { address: 'Anna Nagar, Chennai' } },
      checks: (r) => {
        const fields = ['prediction_text', 'environmental_impact_score', 'degradation_percentage', 'predicted_days_until_critical', 'key_risks'];
        fields.forEach(f => {
          if (r[f] !== undefined && r[f] !== null) ok(`Field '${f}' present`);
          else fail(`Field '${f}' missing`);
        });
        if (Array.isArray(r.key_risks)) ok('key_risks is an array');
        else fail('key_risks is not an array');
        if (r.environmental_impact_score >= 0 && r.environmental_impact_score <= 100) ok('Impact score in 0-100 range');
        else fail('Impact score out of range', `got ${r.environmental_impact_score}`);
      }
    }
  ];

  for (const tc of testCases) {
    console.log(`\n  🧪 ${tc.label}`);
    try {
      const result = await generatePrediction({ ...tc.input, lat: 13.0827, lon: 80.2707 });
      tc.checks(result);
    } catch (e) {
      fail(tc.label, e.message);
    }
  }

  // Restore key
  if (savedKey) process.env.GEMINI_API_KEY = savedKey;
}

// ─── TEST 2: Gemini API check ──────────────────────────────────────────────────
async function testGeminiConnection() {
  section('TEST 2 — Gemini API Connection');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    console.log('  ⚠️  GEMINI_API_KEY not set → Gemini test skipped (fallback text will be used)');
    console.log('  ℹ️  Set GEMINI_API_KEY in .env to enable AI-generated explanations.');
    return;
  }

  try {
    const result = await generatePrediction({
      category: 'sewage_overflow',
      confidence: 0.80,
      locationData: { address: 'Saidapet, Chennai', description: 'residential area' },
      lat: 13.0197,
      lon: 80.2209
    });

    if (result.prediction_text && result.prediction_text.length > 80) {
      ok('Gemini returned a non-trivial prediction text');
      console.log(`\n  📝 Sample Gemini output:\n  "${result.prediction_text.substring(0, 200)}..."`);
    } else {
      fail('Gemini text too short', result.prediction_text);
    }
  } catch (e) {
    fail('Gemini API call threw an error', e.message);
  }
}

// ─── TEST 3: Backend server reachability ────────────────────────────────────────
async function testServerHealth() {
  section('TEST 3 — Backend Server Health');
  try {
    const { data } = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    if (data.status === 'OK') ok('Backend server is healthy');
    else fail('Health check returned unexpected status', JSON.stringify(data));
  } catch (e) {
    fail('Backend server not reachable', e.message);
    console.log('  ℹ️  Make sure `npm run dev` is running in CIVIC-REZO-Backend.');
  }
}

// ─── TEST 4: Full HTTP submission → prediction stored in Supabase ─────────────
async function testFullSubmissionPipeline() {
  section('TEST 4 — Full Complaint Submission Pipeline (HTTP → Supabase)');

  let complaintId = null;
  const testTitle = `TEST_PRED_${Date.now()}`;

  // Step A: Submit complaint
  try {
    const { data } = await axios.post(`${BASE_URL}/api/complaints/submit`, {
      title: testTitle,
      description: 'Test pothole near school for prediction pipeline verification.',
      category: 'pothole',
      locationData: {
        latitude: 13.0574,
        longitude: 80.2532,
        address: 'Velachery near school, Chennai',
        description: 'near school',
        privacyLevel: 'approximate',
        accuracy: 50
      },
      imageValidation: {
        allowUpload: true,
        confidence: 0.87,
        modelConfidence: 0.87
      },
      userId: 'anonymous',
      runSocialScraping: false
    }, { timeout: 20000 });

    if (data.success && data.complaint?.id) {
      complaintId = data.complaint.id;
      ok(`Complaint submitted — ID: ${complaintId}`);
    } else {
      fail('Submission did not return success', JSON.stringify(data).substring(0, 200));
      return;
    }
  } catch (e) {
    fail('Complaint submission HTTP request failed', e.response?.data?.error || e.message);
    return;
  }

  // Step B: Wait for the async prediction to complete (setImmediate + API call)
  console.log('\n  ⏳ Waiting 8 seconds for async prediction to complete...');
  await new Promise(r => setTimeout(r, 8000));

  // Step C: Read from Supabase and verify
  try {
    const { data: rows, error } = await supabase
      .from('complaints')
      .select('id, title, prediction_text, environmental_impact_score, degradation_percentage, predicted_days_until_critical, key_risks')
      .eq('id', complaintId)
      .single();

    if (error) {
      fail('Supabase read-back failed', error.message);
      return;
    }

    console.log('\n  📦 Supabase record:');
    console.log('  ', JSON.stringify(rows, null, 2).split('\n').join('\n  '));

    if (rows.prediction_text && rows.prediction_text.length > 20) ok('prediction_text stored');
    else fail('prediction_text missing or empty');

    if (rows.environmental_impact_score >= 0 && rows.environmental_impact_score <= 100) ok(`environmental_impact_score stored: ${rows.environmental_impact_score}`);
    else fail('environmental_impact_score missing or out of range');

    if (rows.degradation_percentage > 0) ok(`degradation_percentage stored: ${rows.degradation_percentage}%`);
    else fail('degradation_percentage missing');

    if (rows.predicted_days_until_critical > 0) ok(`predicted_days_until_critical stored: ${rows.predicted_days_until_critical} days`);
    else fail('predicted_days_until_critical missing');

    if (Array.isArray(rows.key_risks) && rows.key_risks.length > 0) ok(`key_risks stored: ${rows.key_risks.join(', ')}`);
    else fail('key_risks missing or empty');

  } catch (e) {
    fail('Supabase read-back threw an exception', e.message);
  }

  // Step D: Clean up test complaint
  try {
    // Delete complaint_votes first
    await supabase.from('complaint_votes').delete().eq('complaint_id', complaintId);
    // Delete complaint_updates
    await supabase.from('complaint_updates').delete().eq('complaint_id', complaintId);
    // Delete complaint
    await supabase.from('complaints').delete().eq('id', complaintId);
    ok('Test complaint cleaned up from Supabase');
  } catch (e) {
    console.log(`  ⚠️  Cleanup failed (not critical): ${e.message}`);
  }
}

// ─── RUNNER ───────────────────────────────────────────────────────────────────
async function runAllTests() {
  console.log('\n🚀 UrbanPulse — Prediction System Test Suite');
  console.log('============================================');

  await testRuleBasedLogic();
  await testGeminiConnection();
  await testServerHealth();
  await testFullSubmissionPipeline();

  console.log(`\n${DIVIDER}`);
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log(DIVIDER);

  if (failed === 0) {
    console.log('🎉 All tests passed! The prediction system is working correctly.\n');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review the output above.\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(e => {
  console.error('💥 Test runner crashed:', e);
  process.exit(1);
});
