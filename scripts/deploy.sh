#!/usr/bin/env bash
# ==============================================================================
# deploy.sh — Deploy LexFlow to production via Docker Compose
#
# Usage:
#   ./scripts/deploy.sh                    # Deploy from architect VM to lexflow-prod
#   ./scripts/deploy.sh --local            # Deploy locally (dev)
#
# OWNER: Architect Agent (GOV-008 §3.4)
# REF: SPR-002-ARCH D-009
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

DEPLOY_DIR="/opt/lexflow/codex/deploy"
SSH_KEY="${SSH_KEY:-$HOME/Documents/lexflow/lexflow-codex/keys/forge_fleet}"
REMOTE_HOST="${REMOTE_HOST:-lexflow-prod}"
LOCAL_MODE=false

if [[ "${1:-}" == "--local" ]]; then
    LOCAL_MODE=true
fi

run_remote() {
    if $LOCAL_MODE; then
        eval "$1"
    else
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "bdavidriggins@${REMOTE_HOST}" "echo 'icelimbsheath' | sudo -S bash -c '$1'"
    fi
}

echo "========================================="
echo "  LexFlow Deploy — Docker Compose"
echo "========================================="
echo ""

# --- Step 1: Pull latest code ---
echo -e "${YELLOW}[1/5] Pulling latest code...${NC}"
run_remote "
cd /opt/lexflow/backend && git pull origin main 2>&1 | tail -2
cd /opt/lexflow/frontend && git pull origin main 2>&1 | tail -2
cd /opt/lexflow/codex && git pull origin main 2>&1 | tail -2
"
echo -e "${GREEN}✅ Code pulled${NC}"

# --- Step 2: Build images ---
echo -e "${YELLOW}[2/5] Building Docker images...${NC}"
run_remote "
cd ${DEPLOY_DIR}
docker compose build --no-cache 2>&1 | tail -5
"
echo -e "${GREEN}✅ Images built${NC}"

# --- Step 3: Deploy (rolling) ---
echo -e "${YELLOW}[3/5] Deploying containers...${NC}"
run_remote "
cd ${DEPLOY_DIR}
docker compose up -d 2>&1 | tail -10
"
echo -e "${GREEN}✅ Containers deployed${NC}"

# --- Step 4: Wait for health ---
echo -e "${YELLOW}[4/5] Waiting for health checks (30s)...${NC}"
sleep 30

# --- Step 5: Verify ---
echo -e "${YELLOW}[5/5] Verifying health...${NC}"

BACKEND_HEALTH=$(run_remote "curl -sf http://127.0.0.1:80/backend-health 2>/dev/null || echo FAIL")
FRONTEND_HEALTH=$(run_remote "curl -sf http://127.0.0.1:80/api/health 2>/dev/null || echo FAIL")

FAILED=0

echo -n "Backend:  "
if [[ "$BACKEND_HEALTH" == *"ok"* ]]; then
    echo -e "${GREEN}✅ ${BACKEND_HEALTH}${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
    FAILED=1
fi

echo -n "Frontend: "
if [[ "$FRONTEND_HEALTH" == *"ok"* ]]; then
    echo -e "${GREEN}✅ ${FRONTEND_HEALTH}${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
    FAILED=1
fi

echo ""

# --- Container status ---
echo -e "${YELLOW}Container status:${NC}"
run_remote "cd ${DEPLOY_DIR} && docker compose ps"

echo ""
echo "========================================="
if [ "$FAILED" -eq 0 ]; then
    echo -e "  ${GREEN}Deploy successful ✅${NC}"
else
    echo -e "  ${RED}Deploy FAILED — check container logs${NC}"
    echo -e "  Run: ssh ${REMOTE_HOST} 'docker compose -f ${DEPLOY_DIR}/docker-compose.yml logs'"
fi
echo "========================================="

exit $FAILED
