const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Categories eligible for volunteer intervention
const VOLUNTEER_ELIGIBLE_CATEGORIES = [
  'garbage',
  'tree_issue',
  'public_property_damage',
  'stray_animals',
  'other',
  'pothole', // assuming minor
  'water_issue' // assuming minor
];

// POST /api/volunteer/opt-in
router.post('/opt-in', async (req, res) => {
  try {
    const { complaintId, userId } = req.body;
    
    if (!complaintId || !userId) {
      return res.status(400).json({ success: false, error: 'complaintId and userId required' });
    }

    // 0. Resolve a valid user ID to satisfy the foreign key constraint
    // In a real app this comes from auth context. For the hackathon demo, we'll fetch an existing user.
    const { data: validUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (userError || !validUser || validUser.length === 0) {
      return res.status(500).json({ success: false, error: 'No valid user found in database to assign as volunteer.' });
    }
    
    const dbUserId = validUser[0].id;

    // 1. Check if already volunteered using complaint_updates
    const { data: existing, error: checkError } = await supabase
      .from('complaint_updates')
      .select('*')
      .eq('complaint_id', complaintId)
      .eq('updated_by_id', dbUserId)
      .eq('new_status', 'volunteer_assigned');

    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Already volunteered for this issue' });
    }

    // 2. Add to complaint updates for history/notifications AND to track the volunteer
    const { error: insertError } = await supabase
      .from('complaint_updates')
      .insert([{
        complaint_id: complaintId,
        updated_by_id: dbUserId,
        new_status: 'volunteer_assigned',
        update_notes: 'Rotary Member volunteered to help with this issue.',
        created_at: new Date().toISOString()
      }]);

    if (insertError) throw insertError;

    // 3. Update complaint status
    const { error: updateError } = await supabase
      .from('complaints')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() }) // use 'in_progress' to not break UI logic that might check specific statuses
      .eq('id', complaintId);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Successfully opted in as volunteer' });
  } catch (error) {
    console.error('Volunteer opt-in error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/volunteer/complaint/:complaintId
router.get('/complaint/:complaintId', async (req, res) => {
  try {
    const { complaintId } = req.params;

    const { data: volunteers, error } = await supabase
      .from('complaint_updates')
      .select('updated_by_id, created_at, users:updated_by_id(full_name, user_type)')
      .eq('complaint_id', complaintId)
      .eq('new_status', 'volunteer_assigned');

    if (error) throw error;

    // Clean up response for privacy
    const formatted = (volunteers || []).map(v => ({
      userId: v.updated_by_id,
      optedInAt: v.created_at,
      name: v.users && v.users.full_name ? v.users.full_name : 'Rotary Volunteer',
      type: v.users ? v.users.user_type : 'rotary'
    }));

    // Filter unique volunteers just in case there are duplicates
    const unique = formatted.filter((v, i, a) => a.findIndex(t => t.userId === v.userId) === i);

    res.json({ success: true, volunteers: unique, count: unique.length });
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/volunteer/missions/:userId
router.get('/missions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: missions, error } = await supabase
      .from('complaint_updates')
      .select('created_at, complaint_id, complaints(*)')
      .eq('updated_by_id', userId)
      .eq('new_status', 'volunteer_assigned');

    if (error) throw error;

    res.json({ success: true, missions: missions.map(m => m.complaints).filter(Boolean) });
  } catch (error) {
    console.error('Get missions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/volunteer/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    // We want to count how many 'volunteer_assigned' updates each user has made
    // Since Supabase JS client doesn't natively support GROUP BY without RPC, 
    // we'll fetch all volunteer updates and group them in memory (fine for hackathon scale)
    const { data: volunteerUpdates, error } = await supabase
      .from('complaint_updates')
      .select('updated_by_id, users:updated_by_id(full_name, user_type)')
      .eq('new_status', 'volunteer_assigned');

    if (error) throw error;

    const stats = {};
    
    volunteerUpdates.forEach(update => {
      const userId = update.updated_by_id;
      if (!stats[userId]) {
        stats[userId] = {
          id: userId,
          name: update.users && update.users.full_name ? update.users.full_name : 'Rotary Volunteer',
          type: update.users ? update.users.user_type : 'rotary',
          missionsCompleted: 0
        };
      }
      stats[userId].missionsCompleted += 1;
    });

    // Convert to array and sort by missions descending
    const leaderboard = Object.values(stats).sort((a, b) => b.missionsCompleted - a.missionsCompleted);

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  VOLUNTEER_ELIGIBLE_CATEGORIES
};
