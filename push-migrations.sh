#!/bin/bash
# Pousse toutes les nouvelles migrations vers Supabase production
# Usage: ./push-migrations.sh

SUPABASE_ACCESS_TOKEN=sbp_3f152229f7a90a4e0bf2fce366b82cfeacb53c03 npx supabase db push
