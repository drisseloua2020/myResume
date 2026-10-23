#!/bin/sh
set -eu
case "$API_PUBLIC_URL" in
  /api|https://*) ;;
  *) echo "API_PUBLIC_URL must be /api or an HTTPS origin" >&2; exit 1 ;;
esac
case "$API_PUBLIC_URL" in
  *[!a-zA-Z0-9:/._-]*) echo "Invalid API_PUBLIC_URL" >&2; exit 1 ;;
esac
printf 'globalThis.__MYRESUME_CONFIG__ = {"apiUrl":"%s"};\n' "$API_PUBLIC_URL" > /usr/share/nginx/html/runtime-config.js
