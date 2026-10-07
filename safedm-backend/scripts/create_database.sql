-- SafeDM — création de la base PostgreSQL LOCAL uniquement
-- (Neon gère la création côté serveur : aucune exécution nécessaire)
-- psql -U postgres -f scripts/create_database.sql

CREATE USER safedm WITH PASSWORD 'safedm';
CREATE DATABASE safedm OWNER safedm;
GRANT ALL PRIVILEGES ON DATABASE safedm TO safedm;
