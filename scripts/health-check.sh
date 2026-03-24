#!/usr/bin/env bash
# ==============================================================================
# health-check.sh — Quick health verification for LexFlow Docker stack
#
# Usage:
#   ./scripts/health-check.sh                # Check via SSH to lexflow-prod
#   ./scripts/health-check.sh --local        # Check localhost (dev)
#
# OWNER: Architect Agent (GOV-008 §3.4)
# REF: SPR-002-ARCH D-009
# ==============================================================================

set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/Documents/lexflow/lexflow-codex/keys/forge_fleet}"
REMOTE_HOST="${REMOTE_HOST:-lexflow-prod}"
LOCAL_MODE=false

if [[ "${1:-}" == "--local" ]]; then
    LOCAL_MODE=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

FAILED=0

run_remote() {
    if $LOCAL_MODE; then
        eval "$1"
    else
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "bdavidriggins@${REMOTE_HOST}" "$1" 2>/dev/null
    fi
}

echo "========================================="
echo "  LexFlow Health Check — Docker"
echo "========================================="
echo ""

# --- Container Status ---
echo -e "${YELLOW}Docker Containers:${NC}"
run_remote "cd /opt/lexflow/codex/deploy && docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null" || echo "Could not get container status"
echo ""

# --- Frontend Health (via nginx) ---
echo -n "Frontend (nginx → lexflow-web:3000)... "
RESPONSE=$(run_remote "curl -sf http://127.0.0.1:80/api/health 2>/dev/null") && {
    echo -e "${GREEN}✅ OK${NC}"
    echo "  ${RESPONSE}"
} || {
    echo -e "${RED}❌ FAIL${NC}"
    FAILED=1
}

# --- Backend Health (via nginx) ---
echo -n "Backend  (nginx → lexflow-trust:4000)... "
RESPONSE=$(run_remote "curl -sf http://127.0.0.1:80/backend-health 2>/dev/null") && {
    echo -e "${GREEN}✅ OK${NC}"
    echo "  ${RESPONSE}"
} || {
    echo -e "${RED}❌ FAIL${NC}"
    FAILED=1
}

# --- PostgreSQL (via Docker) ---
echo -n "PostgreSQL (docker: lexflow-postgres)... "
PG_STATUS=$(run_remote "docker inspect lexflow-postgres --format='{{.State.Health.Status}}' 2>/dev/null") && {
    if [[ "$PG_STATUS" == "healthy" ]]; then
        echo -e "${GREEN}✅ healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  ${PG_STATUS}${NC}"
    fi
} || {
    echo -e "${RED}❌ container not found${NC}"
    FAILED=1
}

# --- nginx ---
echo -n "nginx (docker: lexflow-nginx)... "
NGINX_RUNNING=$(run_remote "docker inspect lexflow-nginx --format='{{.State.Running}}' 2>/dev/null") && {
    if [[ "$NGINX_RUNNING" == "true" ]]; then
        echo -e "${GREEN}✅ running${NC}"
    else
        echo -e "${RED}❌ not running${NC}"
        FAILED=1
    fi
} || {
    echo -e "${RED}❌ container not found${NC}"
    FAILED=1
}

echo ""
echo "========================================="
if [ "$FAILED" -eq 0 ]; then
    echo -e "  ${GREEN}All services healthy ✅${NC}"
else
    echo -e "  ${RED}One or more services FAILED${NC}"
    echo "  Check logs: ssh ${REMOTE_HOST} 'docker compose -f /opt/lexflow/codex/deploy/docker-compose.yml logs'"
fi
echo "========================================="

exit $FAILED
