import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteRequest {
  partnerName: string;
  partnerEmail: string;
  inviteCode: string;
  expiresAt: string;
  appUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication - only admins can send invites
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create a client with the user's auth header to validate the JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Use service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { partnerName, partnerEmail, inviteCode, expiresAt, appUrl }: InviteRequest = await req.json();

    if (!partnerName || !partnerEmail || !inviteCode) {
      throw new Error("Missing required fields");
    }

    // Validate that the invite code exists in the database
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from("partners")
      .select("id, email")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (partnerError || !partner) {
      console.error("Partner validation error:", partnerError);
      return new Response(
        JSON.stringify({ error: "Invalid invite code" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the email matches
    if (partner.email !== partnerEmail) {
      return new Response(
        JSON.stringify({ error: "Email mismatch" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const configuredBaseUrl =
      Deno.env.get("APP_BASE_URL") ||
      Deno.env.get("PUBLIC_APP_URL") ||
      "https://thomas-jean-courtage.lovable.app";

    const sanitizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

    let baseUrl = sanitizeBaseUrl(configuredBaseUrl);

    if (typeof appUrl === "string" && appUrl.trim().length > 0) {
      try {
        const u = new URL(appUrl.trim());
        const host = u.hostname.toLowerCase();
        const isEditorHost = host.endsWith("lovableproject.com") || host.endsWith("lovable.dev");
        if (!isEditorHost) {
          baseUrl = sanitizeBaseUrl(`${u.protocol}//${u.host}`);
        }
      } catch {
        // ignore invalid URL and keep fallback
      }
    }

    const inviteLink = `${baseUrl}/invite/${inviteCode}`;
    console.log("Invite link generated:", inviteLink);
    const expirationDate = new Date(expiresAt).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const emailResponse = await resend.emails.send({
      from: "Thomas Jean Courtage <contact@thomas-jean-courtage.fr>",
      to: [partnerEmail],
      subject: "Invitation à rejoindre Thomas Jean Courtage",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Thomas Jean Courtage</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Plateforme Partenaires</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <h2 style="color: #1e3a5f; margin: 0 0 20px 0;">Bonjour ${partnerName},</h2>
              
              <p style="color: #4a5568; line-height: 1.6; margin: 0 0 20px 0;">
                Vous êtes invité(e) à rejoindre la plateforme de gestion de leads de Thomas Jean Courtage en tant que partenaire.
              </p>
              
              <p style="color: #4a5568; line-height: 1.6; margin: 0 0 30px 0;">
                Cette plateforme vous permettra de soumettre vos leads pour l'assurance emprunteur et de suivre leur progression en temps réel.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Créer mon compte
                </a>
              </div>
              
              <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="color: #718096; font-size: 14px; margin: 0;">
                  <strong>⏰ Cette invitation expire le ${expirationDate}</strong>
                </p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              
              <p style="color: #a0aec0; font-size: 12px; margin: 0; text-align: center;">
                Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Partner invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-partner-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
