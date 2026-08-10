-- SafeDM — creation de la base PostgreSQL
-- psql -U postgres -f scripts/create_database.sql

CREATE USER safedm WITH PASSWORD 'safedm';
CREATE DATABASE safedm OWNER safedm;
GRANT ALL PRIVILEGES ON DATABASE safedm TO safedm;
