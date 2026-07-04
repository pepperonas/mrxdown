#!/usr/bin/env bash
#
# install-macos.sh — build, sign, and install MrxDown into /Applications.
#
# WHY THIS SCRIPT EXISTS (pattern borrowed from inspector-rust):
#   MrxDown has no Apple Developer ID. A plain electron-builder build is
#   ad-hoc-signed, so Gatekeeper treats every rebuild as a brand-new,
#   unverifiable app ("beschädigt"/quarantine dance on each update).
#
#   THE FIX — a stable self-signed certificate:
#   This script creates (once) a self-signed code-signing certificate in a
#   dedicated, script-managed keychain
#   (~/Library/Keychains/mrxdown-signing.keychain-db) and signs every build
#   with it. With a real certificate — even self-signed — the app's identity
#   stays constant across rebuilds:
#
#       identifier "com.pepperonas.mrxdown" and
#       certificate leaf = H"<stable cert hash>"
#
#   You approve the app ONCE and every future update installs silently.
#
#   The certificate is created fully non-interactively — no admin password,
#   no GUI "Always Allow" prompt. Its keychain has a hard-coded local
#   password: it holds nothing but a self-signed code-signing key that is
#   worthless off this machine, so the password is not a secret.
#
#   If certificate creation fails for any reason, the script falls back to
#   ad-hoc signing + quarantine-stripping (the previous behaviour), so it
#   never hard-fails.
#
# USAGE:
#   bash scripts/install-macos.sh            # build + sign + install + launch
#   bash scripts/install-macos.sh --no-launch
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_ID="com.pepperonas.mrxdown"
APP_NAME="MrxDown.app"
INSTALL_PATH="/Applications/${APP_NAME}"

SIGN_KEYCHAIN="${HOME}/Library/Keychains/mrxdown-signing.keychain-db"
SIGN_CERT_CN="MrxDown Local Code Signing"
# Hard-coded on purpose — see header. Not a secret.
SIGN_KEYCHAIN_PW="mrxdown-local"

DO_LAUNCH=1
for arg in "$@"; do
  case "$arg" in
    --no-launch) DO_LAUNCH=0 ;;
    -h|--help)
      sed -n '2,/^set -euo pipefail/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ── stable self-signed cert (once), else "-" = ad-hoc ───────────────────────
ensure_signing_cert() {
  if [[ ! -f "${SIGN_KEYCHAIN}" ]] \
     || ! security find-certificate -c "${SIGN_CERT_CN}" "${SIGN_KEYCHAIN}" >/dev/null 2>&1; then
    echo "▸ Creating a stable self-signed signing certificate (one-time)…" >&2
    local tmp
    tmp="$(mktemp -d)" || { echo "-"; return 0; }

    cat > "${tmp}/cert.cnf" <<CNF
[ req ]
distinguished_name = dn
x509_extensions    = v3
prompt             = no
[ dn ]
CN = ${SIGN_CERT_CN}
[ v3 ]
basicConstraints   = critical, CA:false
keyUsage           = critical, digitalSignature
extendedKeyUsage   = critical, codeSigning
CNF

    if ! openssl req -x509 -newkey rsa:2048 -nodes \
          -keyout "${tmp}/key.pem" -out "${tmp}/cert.pem" \
          -days 3650 -config "${tmp}/cert.cnf" >/dev/null 2>&1; then
      echo "  ⚠ openssl cert generation failed — falling back to ad-hoc signing" >&2
      rm -rf "${tmp}"; echo "-"; return 0
    fi
    # Legacy PKCS#12 algorithms — macOS' `security import` can't read the
    # OpenSSL-3 AES/SHA-256 default ("MAC verification failed").
    if ! openssl pkcs12 -export -name "${SIGN_CERT_CN}" \
          -inkey "${tmp}/key.pem" -in "${tmp}/cert.pem" \
          -out "${tmp}/cert.p12" -passout "pass:${SIGN_KEYCHAIN_PW}" \
          -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg SHA1 >/dev/null 2>&1; then
      echo "  ⚠ openssl p12 export failed — falling back to ad-hoc signing" >&2
      rm -rf "${tmp}"; echo "-"; return 0
    fi

    if [[ ! -f "${SIGN_KEYCHAIN}" ]]; then
      if ! security create-keychain -p "${SIGN_KEYCHAIN_PW}" "${SIGN_KEYCHAIN}" 2>/dev/null; then
        echo "  ⚠ keychain create failed — falling back to ad-hoc signing" >&2
        rm -rf "${tmp}"; echo "-"; return 0
      fi
    fi
    security set-keychain-settings "${SIGN_KEYCHAIN}" 2>/dev/null || true
    security unlock-keychain -p "${SIGN_KEYCHAIN_PW}" "${SIGN_KEYCHAIN}" 2>/dev/null || true

    if ! security import "${tmp}/cert.p12" -k "${SIGN_KEYCHAIN}" \
          -P "${SIGN_KEYCHAIN_PW}" -A >/dev/null 2>&1; then
      echo "  ⚠ keychain import failed — falling back to ad-hoc signing" >&2
      rm -rf "${tmp}"; echo "-"; return 0
    fi
    security set-key-partition-list -S apple-tool:,apple: \
      -s -k "${SIGN_KEYCHAIN_PW}" "${SIGN_KEYCHAIN}" >/dev/null 2>&1 || true

    if ! security add-trusted-cert -r trustRoot -p codeSign \
          "${tmp}/cert.pem" >/dev/null 2>&1; then
      echo "  ⚠ could not trust the certificate — falling back to ad-hoc" >&2
      rm -rf "${tmp}"; echo "-"; return 0
    fi

    rm -rf "${tmp}"
    echo "  ✓ certificate created + trusted" >&2
  fi

  security unlock-keychain -p "${SIGN_KEYCHAIN_PW}" "${SIGN_KEYCHAIN}" 2>/dev/null || true
  # Keychain in die Suchliste aufnehmen (idempotent)
  if ! security list-keychains -d user | grep -qF "${SIGN_KEYCHAIN}"; then
    local existing
    existing=$(security list-keychains -d user | sed 's/^ *"//; s/"$//')
    # shellcheck disable=SC2086
    security list-keychains -d user -s ${existing} "${SIGN_KEYCHAIN}" 2>/dev/null || true
  fi

  if security find-identity -v -p codesigning "${SIGN_KEYCHAIN}" 2>/dev/null \
       | grep -qF "${SIGN_CERT_CN}"; then
    echo "${SIGN_CERT_CN}"
  else
    echo "  ⚠ signing identity not valid — falling back to ad-hoc" >&2
    echo "-"
  fi
  return 0
}

# ── build ────────────────────────────────────────────────────────────────────
cd "${REPO_ROOT}"
echo "▸ Building MrxDown (electron-builder)…"
npm run build-mac >/dev/null

ARCH="$(uname -m)"
if [[ "${ARCH}" == "arm64" ]]; then
  BUILD_OUT="${REPO_ROOT}/dist/mac-arm64/${APP_NAME}"
else
  BUILD_OUT="${REPO_ROOT}/dist/mac/${APP_NAME}"
fi
[[ -d "${BUILD_OUT}" ]] || { echo "✗ build output not found: ${BUILD_OUT}" >&2; exit 1; }

# ── sign ─────────────────────────────────────────────────────────────────────
SIGN_ID="$(ensure_signing_cert)"
if [[ "${SIGN_ID}" == "-" ]]; then
  echo "▸ Signing ad-hoc…"
else
  echo "▸ Signing with stable identity: ${SIGN_ID}"
fi
codesign --force --deep --sign "${SIGN_ID}" --identifier "${BUNDLE_ID}" "${BUILD_OUT}"
xattr -cr "${BUILD_OUT}" 2>/dev/null || true

# ── graceful quit of a running instance ─────────────────────────────────────
if pgrep -f "/Applications/MrxDown.app/Contents/MacOS/MrxDown" >/dev/null 2>&1; then
  echo "▸ MrxDown läuft — bitte ungespeicherte Änderungen sichern. Beende sanft…"
  osascript -e 'tell application "MrxDown" to quit' >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    pgrep -f "/Applications/MrxDown.app/Contents/MacOS/MrxDown" >/dev/null 2>&1 || break
    sleep 0.5
  done
  if pgrep -f "/Applications/MrxDown.app/Contents/MacOS/MrxDown" >/dev/null 2>&1; then
    echo "✗ MrxDown läuft noch (offener Speichern-Dialog?). Bitte manuell beenden und erneut ausführen." >&2
    exit 1
  fi
fi

# ── install + launch ─────────────────────────────────────────────────────────
echo "▸ Installing to ${INSTALL_PATH}…"
rm -rf "${INSTALL_PATH}"
cp -R "${BUILD_OUT}" "${INSTALL_PATH}"

if [[ "${DO_LAUNCH}" == "1" ]]; then
  echo "▸ Launching…"
  open "${INSTALL_PATH}"
fi
echo "✓ MrxDown installiert ($(defaults read "${INSTALL_PATH}/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo '?'))"
