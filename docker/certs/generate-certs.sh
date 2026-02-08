#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/../.." && pwd)/.data/certs"

if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
    echo "Certificates already exist in $CERT_DIR — skipping."
    exit 0
fi

mkdir -p "$CERT_DIR"

echo "Generating self-signed certificate..."

openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/CN=warehouse.local" \
    -addext "subjectAltName=DNS:warehouse.local,DNS:localhost,IP:127.0.0.1"

echo "Certificates written to $CERT_DIR"
