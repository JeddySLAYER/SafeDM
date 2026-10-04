"""Analyse semantique via TypeSafe Jev (System One).

Remplace Gemini (V1). Trois ameliorations concretees :

1. **Reponses typees, pas du JSON genere.** Gemini pouvait renvoyer du texte
   illisible (`GEMINI_INVALID_JSON`). Jev renvoie des `Choice`/`Noul`/`Score`
   structures : il n'y a rien a parser ni a valider.

2. **Score calibre.** `risk_score` n'est plus un entier invente par le modele,
   c'est `100 * P(verdicts malveillants)` lu dans la distribution de reponse.
   Le modele ne peut pas "oublier" de mettre un score : la somme fait 1.

3. **Une vraie mesure d'incertitude.** `verdict.confidence` permet le routage
   par confiance que `fusion_service` exploitait impossiblement avec Gemini.

Les cinq questions sont posees dans UN SEUL appel : Jev les evalue en parallele,
donc le surcout en tokens est marginal et le cout en latence reste celui d'un
seul aller-retour.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from typesafe_sdk import Choice, Noul, Score, TypeSafeClient
from typesafe_sdk import (
    TypeSafeAPIConnectionError,
    TypeSafeAPIError,
    TypeSafeAPITimeoutError,
)

from app.core.config import Settings, get_settings
from app.schemas.analysis_enums import ThreatType
from app.services.semantic_types import SemanticResult

logger = logging.getLogger(__name__)

# Verdicts Jev consideres comme confirmes malveillants. Leur somme donne le score.
_MALICIOUS_VERDICTS = ("phishing", "social_engineering", "scam_financial")

# Correspondance verdict Jev -> enum SafeDM. Les verdicts benignes tombent a NONE
# et la fusion remplacera NONE par OTHER des que le statut n'est plus SAFE.
_VERDICT_TO_THREAT_TYPE = {
    "phishing": ThreatType.PHISHING,
    "social_engineering": ThreatType.SOCIAL_ENGINEERING,
    "scam_financial": ThreatType.SOCIAL_ENGINEERING,
    "legitimate": ThreatType.NONE,
    "benign_marketing": ThreatType.NONE,
    "none": ThreatType.NONE,
}

_URGENCY_LEVELS = [
    "Aucun ton urgent : le message est neutre.",
    "Legere pression temporelle, sans menace de consequence.",
    "Urgence explicite : le message pousse a agir vite.",
    "Urgence forte avec menace de blocage, de sanction ou de perte.",
    "Urgence maximale : sanction imminente contre l'utilisateur.",
]

# Les cinq questions posees a chaque analyse, en un seul appel.
_SEMANTIC_QUESTIONS: dict[str, Any] = {
    "verdict": Choice(
        instructions=(
            "Classe ce SMS selon le risque principal pour le destinataire. "
            "Choisis 'legitimate' si c'est une notification transactionnelle "
            "normale d'une banque, d'un operateur ou d'un service identifie, "
            "meme si elle contient un code, un montant ou un avertissement de "
            "securite."
        ),
        criteria={
            "phishing": (
                "Usurpation d'une marque pour obtenir des identifiants, un code "
                "d'authentification ou des coordonnees bancaires."
            ),
            "social_engineering": (
                "Manipule la confiance, l'urgence ou l'autorite pour obtenir une "
                "action ou une information du destinataire."
            ),
            "scam_financial": (
                "Promet un gain, une loterie ou un remboursement, ou reclame un "
                "paiement en amont."
            ),
            "legitimate": (
                "Notification ou message normal d'un expediteur identifie, sans "
                "pression ni demande inhabituelle."
            ),
            "benign_marketing": (
                "Publicite, promotion ou rappel administratif sans "
                "sollicitation sensible."
            ),
            "none": "Aucun risque identifiable dans ce message.",
        },
    ),
    "urgency": Score(
        instructions=(
            "A quel point ce message utilise-t-il l'urgence ou la pression "
            "temporelle pour faire agir le destinataire ?"
        ),
        criteria=_URGENCY_LEVELS,
    ),
    "credential_request": Noul(
        instructions=(
            "Reponds 0 si le message RECOIT, AFFICHE ou RAPPELLE un code (OTP, "
            "PIN) ou une reference : c'est une notification, pas une demande.\n"
            "Reponds 1 uniquement si le message EXIGE que le destinataire "
            "FOURNISSE un mot de passe, un code, un RIB ou une coordonnee "
            "bancaire."
        ),
    ),
    "sensitive_data_request": Noul(
        instructions=(
            "Reponds 1 uniquement si le message EXIGE que le destinataire "
            "FOURNISSE des donnees sensibles (numero de carte complet, CVV, RIB, "
            "mot de passe, piece d'identite) ou exige un transfert d'argent."
        ),
    ),
    "link_deception": Noul(
        instructions=(
            "Reponds 1 uniquement si le message PIEGE : lien raccourci ou domaine "
            "dissimule, QR code, ou incitation a appeler un numero choisi par "
            "l'attaquant.\n"
            "Reponds 0 si le message cite un canal officiel connu (site de la "
            "banque, service client de l'operateur, code USSD court, lien de "
            "suivi de commande)."
        ),
    ),
}

_RECOMMENDATIONS = {
    "credential_request": "Ne communiquez jamais un mot de passe ni un code reçu par SMS",
    "sensitive_data_request": "Ne transmettez aucune information bancaire ou personnelle",
    "link_deception": "Ne cliquez pas sur le lien : vérifiez la demande par un canal officiel",
}


class JevService:
    """Enveloppe synchrone autour du SDK TypeSafe.

    Le client est injectable pour les tests, et construit paresseusement pour ne
    pas payer l'initialisation (et le cout de Timeout) quand la cle API manque.
    """

    def __init__(
        self,
        settings: Optional[Settings] = None,
        client: Optional[TypeSafeClient] = None,
    ):
        self.settings = settings or get_settings()
        self._client = client

    # ------------------------------------------------------------------ client

    def _build_client(self) -> TypeSafeClient:
        return TypeSafeClient(
            api_key=self.settings.typesafe_api_key,
            model=self.settings.typesafe_model,
            timeout=float(self.settings.typesafe_timeout_seconds),
        )

    def _get_client(self) -> TypeSafeClient:
        if self._client is None:
            self._client = self._build_client()
        return self._client

    # ----------------------------------------------------------------- analyse

    def analyze(
        self,
        content: str,
        urls: Optional[list[str]] = None,
    ) -> SemanticResult:
        """Juge un message. `urls` alimente l'etat pour `link_deception`.

        L'ordre d'appel importe : `analysis_service` extrait les URLs avant
        d'appeler ce service, afin de ne transmettre au juge qu'une seule fois.
        """
        if self.settings.analysis_demo_mode and not self.settings.typesafe_api_key:
            from app.services.demo_providers import demo_jev_analyze

            logger.warning("Jev running in ANALYSIS_DEMO_MODE")
            return demo_jev_analyze(content)

        if not self.settings.typesafe_api_key:
            logger.warning("TypeSafe API key missing - semantic analysis unavailable")
            return SemanticResult(available=False, error="TYPESAFE_API_KEY_MISSING")

        state = {
            "message": content[: self.settings.typesafe_max_content_chars],
            "urls": urls or [],
        }

        try:
            response = self._get_client().system_one(
                state=state,
                questions=_SEMANTIC_QUESTIONS,
                model=self.settings.typesafe_model,
            )
        except TypeSafeAPITimeoutError:
            logger.error("Jev timeout")
            return SemanticResult(available=False, error="TYPESAFE_TIMEOUT")
        except TypeSafeAPIConnectionError:
            logger.error("Jev network error")
            return SemanticResult(available=False, error="TYPESAFE_NETWORK_ERROR")
        except TypeSafeAPIError as exc:
            # 401/403/429 et erreurs serveur ont tous une cause actionnable.
            status = getattr(getattr(exc, "response", None), "status_code", None)
            logger.error("Jev API error status=%s", status)
            if status is not None:
                return SemanticResult(available=False, error=f"TYPESAFE_HTTP_{status}")
            return SemanticResult(available=False, error="TYPESAFE_API_ERROR")
        except Exception:
            logger.exception("Jev unexpected error")
            return SemanticResult(available=False, error="TYPESAFE_UNEXPECTED_ERROR")

        return self._to_result(response.answers, response)

    def analyze_features(self, features: list[int]) -> SemanticResult:
        """Analyse le vecteur engineered sans transmettre le contenu textuel."""
        try:
            response = self._get_client().system_one(
                state={"features": features},
                questions=_SEMANTIC_QUESTIONS,
                model=self.settings.typesafe_model,
            )
        except (
            TypeSafeAPITimeoutError,
            TypeSafeAPIConnectionError,
            TypeSafeAPIError,
        ) as exc:
            logger.error("Jev feature analysis failed: %s", type(exc).__name__)
            return SemanticResult(available=False, error="TYPESAFE_FEATURE_ANALYSIS_FAILED")
        except Exception:
            logger.exception("Jev feature analysis unexpected error")
            return SemanticResult(available=False, error="TYPESAFE_FEATURE_ANALYSIS_FAILED")
        return self._to_result(response.answers, response)

    # -------------------------------------------------------------- conversion

    def _to_result(self, answers: dict[str, Any], response: Any) -> SemanticResult:
        verdict = answers.get("verdict")
        if verdict is None:
            logger.error("Jev response missing 'verdict' answer")
            return SemanticResult(available=False, error="TYPESAFE_MALFORMED_ANSWER")

        probabilities: dict[str, float] = dict(verdict.probabilities or {})
        malicious_probability = sum(
            float(probabilities.get(name, 0.0)) for name in _MALICIOUS_VERDICTS
        )
        risk_score = int(round(max(0.0, min(1.0, malicious_probability)) * 100))

        verdict_name = str(verdict.choice)
        threat_type = _VERDICT_TO_THREAT_TYPE.get(verdict_name, ThreatType.OTHER)

        reasons = self._build_reasons(answers, verdict_name, risk_score)
        recommendations = self._build_recommendations(answers)

        raw = {
            "model": getattr(response, "model", None),
            "verdict_probabilities": probabilities,
            "usage": {
                "input_tokens": getattr(getattr(response, "usage", None), "input_tokens", None)
            },
        }

        return SemanticResult(
            available=True,
            risk_score=risk_score,
            severity=None,  # derive du score dans fusion_service, comme pour les autres sources
            threat_type=threat_type,
            reasons=reasons,
            recommendations=recommendations,
            confidence=float(verdict.confidence),
            raw=raw,
        )

    def _build_reasons(
        self,
        answers: dict[str, Any],
        verdict_name: str,
        risk_score: int,
    ) -> list[str]:
        reasons: list[str] = []

        if risk_score >= 35:
            label = {
                "phishing": "Phishing",
                "social_engineering": "Manipulation par ingénierie sociale",
                "scam_financial": "Arnaque financière",
            }.get(verdict_name, "Contenu suspect")
            reasons.append(f"Jev identifie un risque de type {label} ({risk_score}/100)")

        urgency = answers.get("urgency")
        if urgency is not None and int(getattr(urgency, "score", 0)) >= 2:
            level = int(urgency.score)
            reasons.append(f"Urgence de niveau {level}/{len(_URGENCY_LEVELS) - 1}")

        for question_id, label in (
            ("credential_request", "Demande d'identifiants ou de code d'authentification"),
            ("sensitive_data_request", "Demande de données sensibles"),
            ("link_deception", "Redirection vers un lien ou un numéro piégé"),
        ):
            answer = answers.get(question_id)
            if answer is not None and float(getattr(answer, "noul", 0.0)) >= 0.5:
                reasons.append(label)

        return reasons[:10]

    def _build_recommendations(self, answers: dict[str, Any]) -> list[str]:
        recommendations: list[str] = []
        for question_id, text in _RECOMMENDATIONS.items():
            answer = answers.get(question_id)
            if answer is not None and float(getattr(answer, "noul", 0.0)) >= 0.5:
                recommendations.append(text)
        return recommendations[:10]