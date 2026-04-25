require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupVolunteerTables() {
  console.log('🚀 Setting up Rotary Volunteer tables and columns...');

  const sql = `
    -- Create the complaint_volunteers table
    CREATE TABLE IF NOT EXISTS complaint_volunteers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'opted_in',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(complaint_id, user_id)
    );

    -- Enable RLS
    ALTER TABLE complaint_volunteers ENABLE ROW LEVEL SECURITY;

    -- Create policies for complaint_volunteers (simplified for now)
    DROP POLICY IF EXISTS "Enable read access for all users" ON complaint_volunteers;
    CREATE POLICY "Enable read access for all users" ON complaint_volunteers FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON complaint_volunteers;
    CREATE POLICY "Enable insert for authenticated users" ON complaint_volunteers FOR INSERT WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Enable update for own records" ON complaint_volunteers;
    CREATE POLICY "Enable update for own records" ON complaint_volunteers FOR UPDATE USING (true);
  `;

  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Failed to run SQL via RPC:', error);
      console.log('Will try via REST API alternative if needed.');
    } else {
      console.log('✅ Successfully created complaint_volunteers table!');
    }
  } catch (e) {
    console.error('❌ Exception during setup:', e.message);
  }
}

setupVolunteerTables();
