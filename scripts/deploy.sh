#!/usr/bin/env bash
#
# Deploys Parley in the correct order:
#   1. signaling server  → Cloudflare Workers + Durable Objects
#   2. app               → Vercel, with the signaling host wired in
#
# The order matters: the app needs to know the signaling host at BUILD time,
# because NEXT_PUBLIC_* variables are inlined into the client bundle.
#
# Prerequisites (interactive, run these yourself once):
#   npx wrangler login
#   vercel login

set -euo pipefail
cd "$(dirname "$0")/.."

echo "──────────────────────────────────────────────"
echo " 1/3  Checking authentication"
echo "──────────────────────────────────────────────"

# `whoami` always prints a banner, so test for the failure string itself
# rather than "is any line not the failure string".
if ! npx wrangler whoami 2>&1 | grep -q "You are logged in"; then
  echo "❌ Cloudflare: not logged in.  Run:  npx wrangler login"
  exit 1
fi
if ! vercel whoami >/dev/null 2>&1; then
  echo "❌ Vercel: not logged in.  Run:  vercel login"
  exit 1
fi
echo "✅ both authenticated"

echo
echo "──────────────────────────────────────────────"
echo " 2/3  Deploying signaling server → Cloudflare Workers"
echo "──────────────────────────────────────────────"

PARTY_OUT=$(npx wrangler deploy 2>&1 | tee /dev/stderr)
PARTY_HOST=$(echo "$PARTY_OUT" | grep -oE '[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev' | head -1)

if [ -z "$PARTY_HOST" ]; then
  echo "❌ Could not determine the deployed PartyKit host from the output above."
  echo "   Set it manually:  vercel env add NEXT_PUBLIC_PARTYKIT_HOST production"
  exit 1
fi
echo "✅ signaling live at: $PARTY_HOST"

echo
echo "──────────────────────────────────────────────"
echo " 3/3  Deploying app → Vercel"
echo "──────────────────────────────────────────────"

# Replace the variable so re-runs don't stack duplicates.
vercel env rm NEXT_PUBLIC_PARTYKIT_HOST production --yes >/dev/null 2>&1 || true
echo "$PARTY_HOST" | vercel env add NEXT_PUBLIC_PARTYKIT_HOST production

vercel deploy --prod

echo
echo "✅ Done. Open the URL above, create a room, and share the link."
echo "   Signaling: $PARTY_HOST"
