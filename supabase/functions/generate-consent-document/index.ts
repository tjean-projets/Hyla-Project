import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConsentRequest {
  leadId: string;
  partnerName: string;
  prospectFirstName: string;
  prospectLastName: string;
  prospectPhone: string;
  prospectEmail: string | null;
  consentTimestamp: string;
  contractType: string;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  emprunteur: "Emprunteur",
  prevoyance: "Prévoyance",
  rc_pro: "RC Pro",
  sante: "Santé",
  decennale: "Décennale",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is a partner
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!partner) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: ConsentRequest = await req.json();
    const {
      leadId,
      partnerName,
      prospectFirstName,
      prospectLastName,
      prospectPhone,
      prospectEmail,
      consentTimestamp,
      contractType,
    } = body;

    if (!leadId || !partnerName || !prospectFirstName || !prospectLastName || !prospectPhone || !consentTimestamp) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the lead belongs to this partner
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, partner_id")
      .eq("id", leadId)
      .eq("partner_id", partner.id)
      .maybeSingle();

    if (!lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const consentDate = new Date(consentTimestamp);
    const formattedDate = consentDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formattedTime = consentDate.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const contractLabel = CONTRACT_TYPE_LABELS[contractType] || contractType || "Non spécifié";

    // Generate HTML consent document
    const htmlDocument = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Attestation de consentement - ${prospectFirstName} ${prospectLastName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1e3a5f; line-height: 1.6; }
    .header { text-align: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 24px; margin: 0; color: #1e3a5f; }
    .header p { color: #666; margin: 5px 0 0; }
    .badge { display: inline-block; background: #1e3a5f; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; margin-top: 10px; }
    .section { margin: 25px 0; }
    .section h2 { font-size: 16px; color: #1e3a5f; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    .field { display: flex; margin: 8px 0; }
    .field-label { font-weight: 600; min-width: 200px; color: #444; }
    .field-value { color: #222; }
    .consent-box { background: #f0f4f8; border: 1px solid #c8d6e5; border-radius: 8px; padding: 20px; margin: 25px 0; }
    .consent-box p { margin: 0; font-style: italic; }
    .timestamp { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 8px; padding: 15px; margin: 25px 0; text-align: center; }
    .timestamp strong { color: #2e7d32; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Thomas Jean Courtage</h1>
    <p>Attestation de consentement du prospect</p>
    <span class="badge">DOCUMENT HORODATÉ</span>
  </div>

  <div class="section">
    <h2>Informations du prospect</h2>
    <div class="field"><span class="field-label">Nom complet</span><span class="field-value">${prospectFirstName} ${prospectLastName}</span></div>
    <div class="field"><span class="field-label">Téléphone</span><span class="field-value">${prospectPhone}</span></div>
    ${prospectEmail ? `<div class="field"><span class="field-label">Email</span><span class="field-value">${prospectEmail}</span></div>` : ""}
    <div class="field"><span class="field-label">Type de contrat</span><span class="field-value">${contractLabel}</span></div>
  </div>

  <div class="section">
    <h2>Partenaire apporteur</h2>
    <div class="field"><span class="field-label">Nom du partenaire</span><span class="field-value">${partnerName}</span></div>
  </div>

  <div class="consent-box">
    <p>« Je confirme avoir informé la personne susmentionnée que ses coordonnées seraient transmises à Thomas Jean Courtage afin qu'elle soit contactée dans le cadre de services d'assurance. Le prospect a donné son accord explicite pour être recontacté. »</p>
  </div>

  <div class="timestamp">
    <p><strong>Consentement enregistré le ${formattedDate} à ${formattedTime}</strong></p>
    <p style="font-size: 12px; color: #666; margin-top: 5px;">Horodatage automatique - Référence lead : ${leadId}</p>
  </div>

  <div class="footer">
    <p>Ce document a été généré automatiquement par la plateforme Thomas Jean Courtage.</p>
    <p>Il atteste du recueil du consentement du prospect par le partenaire apporteur d'affaires.</p>
  </div>
</body>
</html>`;

    // Store in Supabase Storage
    const fileName = `${partner.id}/consent_${leadId}_${Date.now()}.html`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(fileName, new Blob([htmlDocument], { type: "text/html" }), {
        contentType: "text/html",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to store document" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the file URL
    const fileUrl = `documents/${fileName}`;

    // Update lead with consent document URL
    await supabaseAdmin
      .from("leads")
      .update({ consent_document_url: fileUrl })
      .eq("id", leadId);

    // Add to partner_documents
    await supabaseAdmin.from("partner_documents").insert({
      partner_id: partner.id,
      document_type: "consent",
      file_name: `Consentement - ${prospectFirstName} ${prospectLastName}.html`,
      file_url: fileUrl,
      lead_id: leadId,
    });

    console.log(`Consent document generated for lead ${leadId}`);

    return new Response(
      JSON.stringify({ success: true, fileUrl }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error generating consent document:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
