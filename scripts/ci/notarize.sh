#!/bin/sh
# Notarizes a signed .app with an App Store Connect API key and staples the ticket.
#   APPLE_NOTARY_KEY_P8 (base64 .p8), APPLE_NOTARY_KEY_ID, APPLE_NOTARY_ISSUER_ID
set -eu
app="${1:?usage: notarize.sh <path/to/App.app>}"
: "${APPLE_NOTARY_KEY_P8:?}" "${APPLE_NOTARY_KEY_ID:?}" "${APPLE_NOTARY_ISSUER_ID:?}"
key="$RUNNER_TEMP/notary-key.p8"
echo "$APPLE_NOTARY_KEY_P8" | base64 --decode > "$key"
zip="$RUNNER_TEMP/notarize.zip"
ditto -c -k --keepParent "$app" "$zip"
xcrun notarytool submit "$zip" --key "$key" --key-id "$APPLE_NOTARY_KEY_ID" --issuer "$APPLE_NOTARY_ISSUER_ID" --wait
xcrun stapler staple "$app"
rm -f "$key" "$zip"
echo "notarized and stapled $app"
