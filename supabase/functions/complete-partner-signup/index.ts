import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupRequest {
  partnerId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. REQUIRE AUTHENTICATION - User must be signed in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create authenticated client to verify the user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the authenticated user - this validates the JWT and returns user info
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth validation failed:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { partnerId }: SignupRequest = await req.json();

    if (!partnerId) {
      // Use generic error to prevent enumeration
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role to bypass RLS for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Verify the partner exists and hasn't been used yet
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .single();

    if (partnerError || !partner) {
      throw new Error("Partner not found");
    }

    if (partner.invite_used_at) {
      throw new Error("This invitation has already been used");
    }

    // Check if invite has expired
    if (new Date(partner.invite_expires_at) < new Date()) {
      throw new Error("This invitation has expired");
    }

    // 2. CRITICAL: Verify the authenticated user's email matches the partner's email
    // This prevents account takeover attacks where an attacker tries to link
    // their account to someone else's partner record
    if (user.email !== partner.email) {
      // Use generic error to prevent enumeration of which emails are partners
      console.error(`Email mismatch: user=${user.email}, partner=${partner.email}`);
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 3. Update partner with user_id and mark invite as used
    const { error: updateError } = await supabaseAdmin
      .from("partners")
      .update({
        user_id: user.id,
        invite_used_at: new Date().toISOString(),
      })
      .eq("id", partnerId);

    if (updateError) {
      console.error("Failed to update partner:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to complete signup" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 4. Add partner role to user_roles table
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: user.id,
        role: "partner",
      });

    if (roleError) {
      console.error("Failed to add partner role:", roleError);
      // Don't throw - the partner link is more important
    }

    console.log(`Partner signup completed: partner=${partnerId}, user=${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Partner signup completed" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    // Use generic error message to prevent information leakage
    console.error("Error in complete-partner-signup:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
