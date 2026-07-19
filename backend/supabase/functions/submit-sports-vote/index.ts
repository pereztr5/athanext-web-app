import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    const body = await req.json();
    const { sportOptionId } = body;

    // Enhanced input validation
    if (!sportOptionId || typeof sportOptionId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid sport option ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sportOptionId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid sport option ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Get client IP for duplicate vote prevention
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Hash the IP for privacy-preserving duplicate prevention
    const encoder = new TextEncoder();
    const data = encoder.encode(clientIP);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if this IP hash has already voted recently (within 24 hours)
    const { data: existingVote } = await supabase
      .from('sports_votes')
      .select('id')
      .eq('voter_ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: 'You have already voted recently. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the sport option exists using maybeSingle to avoid errors
    const { data: sportOption, error: sportError } = await supabase
      .from('sports_options')
      .select('id')
      .eq('id', sportOptionId)
      .maybeSingle();

    if (sportError) {
      console.error('Database error checking sport option:', sportError);
      return new Response(
        JSON.stringify({ error: 'Database error occurred' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sportOption) {
      return new Response(
        JSON.stringify({ error: 'Sport option does not exist' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Submit the vote with enhanced error handling
    const { error: voteError } = await supabase
      .from('sports_votes')
      .insert({
        sport_option_id: sportOptionId,
        voter_ip_hash: ipHash
      });

    if (voteError) {
      console.error('Error submitting vote:', voteError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit vote' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Vote submitted successfully for sport option: ${sportOptionId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Vote submitted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-sports-vote function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
