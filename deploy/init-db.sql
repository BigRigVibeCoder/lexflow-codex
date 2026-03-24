-- init-db.sql — Create both databases on first PostgreSQL start
-- This runs automatically via docker-entrypoint-initdb.d
-- The default DB (lexflow_trust) is created by POSTGRES_DB env var.
-- We need to create lexflow_web separately.

CREATE DATABASE lexflow_web OWNER lexflow;
