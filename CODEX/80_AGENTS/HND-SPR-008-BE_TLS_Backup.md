---
id: HND-SPR-008-BE
title: "Backend Handoff: TLS + Backup/Restore (T-076V, T-085)"
type: handoff
status: ACTIVE
owner: architect
agents: [backend]
tags: [handoff, sprint, spr-008, production, security, backup]
related: [SPR-008, T-076V, T-085]
created: 2026-03-25
updated: 2026-03-25
version: 1.0.0
---

# Backend Handoff: TLS + Backup/Restore

**From:** Architect Agent | **To:** Backend Agent
**Sprint:** SPR-008 (Polish & Hardening)
**Branch:** `feature/SPR-008-prod-hardening`

## Context

LexFlow is live on `lexflow-prod` (`34.26.122.46`) serving trust accounting data over **plain HTTP with zero backups**. These are the two highest-risk gaps before v1.0.

---

## T-076V: Production VM Hardening (TLS focus)

**Commit:** `feat(SPR-008): T-076V production VM hardening`

### 1. TLS via Certbot
- Install `certbot` + `python3-certbot-nginx`
- Let's Encrypt doesn't issue certs for bare IPs — need a DNS record pointed at `34.26.122.46`, OR generate self-signed cert as interim and document the limitation
- Update nginx config: redirect 80→443, serve HTTPS
- Auto-renewal cron: `0 3 * * * certbot renew --quiet`

### 2. UFW Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Fail2ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 4. Log Rotation
- Create `/etc/logrotate.d/lexflow` for `/var/log/lexflow/`
- Daily rotation, 7 days retained, compress

**Acceptance:** HTTPS works (or documented limitation for IP-only). UFW active. Fail2ban running.

---

## T-085: Backup & Restore

**Commit:** `feat(SPR-008): T-085 backup and restore verification`

### 1. Backup Script — `scripts/backup.sh`
```bash
#!/bin/bash
BACKUP_DIR=/var/backups/lexflow
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec lexflow-postgres pg_dump -U lexflow lexflow_web > "$BACKUP_DIR/lexflow_web_$DATE.sql"
docker exec lexflow-postgres pg_dump -U lexflow lexflow_trust > "$BACKUP_DIR/lexflow_trust_$DATE.sql"
# Retain 7 days
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
echo "Backup complete: $DATE"
```
- Cron: `0 2 * * * /home/bdavidriggins/scripts/backup.sh`

### 2. Restore Script — `scripts/restore.sh`
```bash
#!/bin/bash
# Usage: ./restore.sh <database_name> <backup_file>
# Example: ./restore.sh lexflow_web /var/backups/lexflow/lexflow_web_20260325.sql
docker exec -i lexflow-postgres psql -U lexflow "$1" < "$2"
echo "Restored $1 from $2"
```

### 3. Verification Test
- Create test data → run backup → drop a table → restore → verify data intact
- Document procedure in `CODEX/30_RUNBOOKS/`

**Acceptance:** Backup cron running. Restore tested. Procedure documented.

---

## VM Reference

| Item | Value |
|:-----|:------|
| **VM** | `lexflow-prod` (GCE `us-east1-b`) |
| **IP** | `34.26.122.46` |
| **SSH** | `ssh -i keys/forge_fleet bdavidriggins@34.26.122.46` |
| **Containers** | `lexflow-postgres`, `lexflow-web`, `lexflow-trust`, `lexflow-nginx` |
| **Docker Network** | `deploy_lexflow-internal` |
| **DB User/Pass** | `lexflow` / `lexflow_dev_password` |
| **Databases** | `lexflow_web` (14 tables), `lexflow_trust` |

---

## After Pushing

1. Push branch `feature/SPR-008-prod-hardening`
2. Architect will merge, verify TLS + backups on prod
3. Re-run E2E suite against HTTPS endpoint
