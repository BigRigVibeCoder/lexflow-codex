#!/usr/bin/env bash
# ==============================================================================
# health-check.sh — Quick health verification for all LexFlow services
#
# Usage:
#   ./scripts/health-check.sh              # Check localhost
#   ./scripts/health-check.sh lexflow-prod  # Check remote host
#
# REF: SPR-001-ARCH A-004
# REF: GOV-008 §3 (PM2 health checks)
# ==============================================================================

set -euo pipefail

HOST="${1:-localhost}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-4000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

FAILED=0

echo "========================================="
echo "  LexFlow Health Check — ${HOST}"
echo "========================================="
echo ""

# --- Frontend Health ---
echo -n "Frontend (${HOST}:${FRONTEND_PORT}/api/health)... "
RESPONSE=$(curl -sf "http://${HOST}:${FRONTEND_PORT}/api/health" 2>/dev/null) && {
    echo -e "${GREEN}✅ OK${NC}"
    echo "  Response: ${RESPONSE}"
} || {
    echo -e "${RED}❌ FAIL${NC}"
    FAILED=1
}

# --- Backend Health ---
echo -n "Backend  (${HOST}:${BACKEND_PORT}/health)... "
RESPONSE=$(curl -sf "http://${HOST}:${BACKEND_PORT}/health" 2>/dev/null) && {
    echo -e "${GREEN}✅ OK${NC}"
    echo "  Response: ${RESPONSE}"
} || {
    echo -e "${RED}❌ FAIL${NC}"
    FAILED=1
}

# --- PostgreSQL ---
echo -n "PostgreSQL... "
if command -v psql &>/dev/null; then
    psql -U lexflow -d lexflow_trust -c "SELECT 1;" &>/dev/null && {
        echo -e "${GREEN}✅ OK${NC}"
    } || {
        echo -e "${YELLOW}⚠️  Cannot connect (may need pg_hba.conf or password)${NC}"
    }
else
    echo -e "${YELLOW}⚠️  psql not available on this host${NC}"
fi

# --- PM2 ---
echo -n "PM2 processes... "
if command -v pm2 &>/dev/null; then
    PM2_COUNT=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    if [ "$PM2_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ ${PM2_COUNT} process(es) running${NC}"
        pm2 list 2>/dev/null
    else
        echo -e "${YELLOW}⚠️  No PM2 processes running${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 not available on this host${NC}"
fi

echo ""
echo "========================================="
if [ "$FAILED" -eq 0 ]; then
    echo -e "  ${GREEN}All services healthy${NC}"
else
    echo -e "  ${RED}One or more services FAILED${NC}"
fi
echo "========================================="

exit $FAILED
