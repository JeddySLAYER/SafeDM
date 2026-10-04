import logging
from functools import lru_cache
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SafeDM"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # Pas de defaut : un secret JWT doit venir de l'environnement. Un defaut
    # code en dur finirait en production et signerait des jetons avec une cle
    # publique du depot. Voir `_validate_secret_key`.
    secret_key: str = ""
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    database_url: str = "postgresql+psycopg2://safedm:safedm@localhost:5432/safedm"

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:3000,http://127.0.0.1:3000"
    )

    # TypeSafe — Jev (System One). Remplace Gemini en V2.
    # Jev renvoie des probabilites calibrees : pas de parsing JSON, pas de JSON invalide.
    typesafe_api_key: str = ""
    typesafe_model: str = "jev-latest"
    # Jev est sur le chemin d'escalade, pas sur le chemin critique de la notification.
    # On borne fortement le budget : au-dela, on degrade en PARTIAL plutot que de bloquer.
    typesafe_timeout_seconds: int = 15
    # Jev a 32k tokens de budget sur `state`. 6000 caracteres suffisent largement
    # pour un SMS/WhatsApp et evite de payer le context inutile.
    typesafe_max_content_chars: int = 6000

    virustotal_api_key: str = ""
    virustotal_base_url: str = "https://www.virustotal.com/api/v3"
    virustotal_timeout_seconds: int = 30
    fingerprint_private_key_pem_b64: str = ""

    # --- Seuils de decision (politique produit, pas technique) -------------
    # Policy de decision,see docs/FEATURE_SCHEMA.md et le benchmark Sprint 10.
    # Un seuil code en dur est impossible a recaler apres mesure sans
    # redeloiement : c'est la raison d'etre de ces variables.

    # En dessous de cette confiance Jev, un verdict SAFE est degrade en PARTIAL.
    # Recale par le benchmark : 0.40 ne couvrait que 3 erreurs sur 14, 0.65 en
    # couvre 7. Monter plus haut fait exploser le nombre de messages escalades.
    threshold_uncertainty_confidence: float = 0.65
    # Au-dessus de cette confiance, aucun besoin d'escalade : le mobile tranche
    # seul. En dessous, on propose a l'utilisateur de consentir a l'appel Jev.
    threshold_escalation_confidence: float = 0.65
    # Bornes de score qui font basculer le statut final.
    threshold_safe_score: int = 35
    threshold_suspicious_score: int = 65
    threshold_critical_score: int = 85
    # Plancher impose quand on degrade un resultat (juge incertain ou source
    # indisponible) : on ne veut jamais afficher SAFE.
    uncertain_score_floor: int = 40

    # Mode demo local (sans cles API) — ne pas utiliser en production
    analysis_demo_mode: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    def _validate_secret_key(self) -> None:
        """Refuse de demarrer avec un secret faible ou absent.

        En developpement on tolere un secret court pour ne pas bloquer un novice
        sur `uvicorn`. En production, un secret manquant ou evident doit
        empecher le demarrage : mieux vaut une API en panne qu'une API dont
        n'importe qui forge les jetons.
        """
        weak = {
            "",
            "change-me-to-a-long-random-string",
            "change-me",
            "secret",
            "dev-secret-change-me",
        }
        if self.secret_key in weak or (
            not self.is_production and len(self.secret_key) < 16
        ):
            if self.is_production:
                raise ValueError(
                    "SECRET_KEY doit etre definie et forte en production. "
                    "Generez-en une avec : python -c \"import secrets;"
                    " print(secrets.token_urlsafe(64))\""
                )
            logger.warning(
                "SECRET_KEY absente ou tres courte. Acceptable en developpement, "
                "INTERDIT en production."
            )

    def model_post_init(self, __context: Any) -> None:
        self._validate_secret_key()


@lru_cache
def get_settings() -> Settings:
    return Settings()
