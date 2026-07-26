-- Templates de messages (WhatsApp/SMS) par user.
-- Format: JSONB array de { id: string, name: string, channel: 'whatsapp'|'sms', body: string }
-- Utilisation: bouton "Envoyer" sur ContactDrawer déroule les templates et ouvre
-- whatsapp://send?text=... ou sms:?body=... avec le corps pré-rempli, en substituant
-- {prenom}, {nom}, {full_name} par les infos du contact.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS message_templates JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_settings.message_templates IS
  'Templates messages: [{id, name, channel: whatsapp|sms, body}] — variables {prenom} {nom} {full_name}';
