#!/usr/bin/env bash
# TallyBard — Ollama bootstrap for a DigitalOcean droplet.
# Installs Ollama bound to localhost, pulls models, puts Caddy in front with a
# bearer token (raw Ollama is never exposed). UFW allows only 22/80/443.
#
# Usage (as root on Ubuntu 24.04):
#   OLLAMA_BEARER=<token> DOMAIN=models.example.com MODELS="embeddinggemma gemma4:e2b" \
#     bash bootstrap-ollama.sh
#   DOMAIN may be empty -> Caddy serves HTTP :80 with the bearer (demo only).
set -euo pipefail

OLLAMA_BEARER="${OLLAMA_BEARER:?set OLLAMA_BEARER to a long random token}"
DOMAIN="${DOMAIN:-}"
MODELS="${MODELS:-embeddinggemma gemma4:e2b}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw curl ca-certificates

# --- Ollama ----------------------------------------------------------------
if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
mkdir -p /etc/systemd/system/ollama.service.d
cat >/etc/systemd/system/ollama.service.d/bind.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
EOF
systemctl daemon-reload
systemctl enable --now ollama
sleep 3
for m in $MODELS; do
  echo ">>> pulling $m"
  ollama pull "$m"
done

# --- Caddy -----------------------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y -qq caddy
fi
if [ -n "$DOMAIN" ]; then
  SITE="$DOMAIN"
else
  SITE=":80"
fi
cat >/etc/caddy/Caddyfile <<EOF
$SITE
@unauthorized not header Authorization "Bearer ${OLLAMA_BEARER}"
respond @unauthorized 401
reverse_proxy 127.0.0.1:11434
EOF
systemctl reload caddy || systemctl restart caddy

# --- Firewall ----------------------------------------------------------------
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Done. Verify from your laptop:"
echo "  curl -s http://\$(curl -s ifconfig.me)/v1/models -H 'Authorization: Bearer \$OLLAMA_BEARER'"
