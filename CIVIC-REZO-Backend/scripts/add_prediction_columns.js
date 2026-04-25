require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function addPredictionColumns() {
  console.log('🔧 Adding prediction columns to complaints table...');

  // We do them one at a time to handle "already exists" gracefully
  const columns = [
    { name: 'prediction_text', type: 'TEXT' },
    { name: 'environmental_impact_score', type: 'INTEGER' },
    { name: 'degradation_percentage', type: 'FLOAT' },
    { name: 'predicted_days_until_critical', type: 'INTEGER' },
    { name: 'key_risks', type: 'JSONB' },
  ];

  for (const col of columns) {
    try {
      const { error } = await supabase.rpc('execute_sql', {
        sql_query: `ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
      });

      if (error) {
        // execute_sql RPC may not exist — try the direct approach below
        console.warn(`⚠️  RPC failed for ${col.name}:`, error.message);
      } else {
        console.log(`✅ Column '${col.name}' (${col.type}) is ready.`);
      }
    } catch (e) {
      console.warn(`⚠️  Exception for ${col.name}:`, e.message);
    }
  }

  // Verify by reading schema
  const { data, error } = await supabase
    .from('complaints')
    .select('prediction_text, environmental_impact_score, degradation_percentage, predicted_days_until_critical, key_risks')
    .limit(1);

  if (error) {
    console.error('❌ Column verification failed:', error.message);
    console.log('\n📋 MANUAL MIGRATION REQUIRED - Run this SQL in Supabase SQL Editor:');
    console.log(`
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS prediction_text TEXT,
  ADD COLUMN IF NOT EXISTS environmental_impact_score INTEGER,
  ADD COLUMN IF NOT EXISTS degradation_percentage FLOAT,
  ADD COLUMN IF NOT EXISTS predicted_days_until_critical INTEGER,
  ADD COLUMN IF NOT EXISTS key_risks JSONB;
    `);
  } else {
    console.log('\n🎉 All prediction columns are present and accessible!');
  }

  process.exit(0);
}

addPredictionColumns();
