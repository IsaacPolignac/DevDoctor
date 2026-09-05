#!/bin/sh
# Imports a Developer ID Application certificate (base64 .p12 in APPLE_CERTIFICATE_P12,
# password in APPLE_CERTIFICATE_PASSWORD) into a temporary keychain on a CI runner.
set -eu
: "${APPLE_CERTIFICATE_P12:?}" "${APPLE_CERTIFICATE_PASSWORD:?}"
keychain="$RUNNER_TEMP/devdoctor-signing.keychain-db"
keychain_password="$(uuidgen)"
echo "$APPLE_CERTIFICATE_P12" | base64 --decode > "$RUNNER_TEMP/cert.p12"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$RUNNER_TEMP/cert.p12" -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$keychain"
security set-key-partition-list -S apple-tool:,apple: -k "$keychain_password" "$keychain" >/dev/null
security list-keychain -d user -s "$keychain" login.keychain-db
rm -f "$RUNNER_TEMP/cert.p12"
echo "certificate imported into $keychain"
