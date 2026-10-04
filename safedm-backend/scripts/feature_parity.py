#!/usr/bin/env python3
"""Test differentiel Python <-> Kotlin pour le contrat de features V2.

La fixture doree (`tests/fixtures/feature_vectors.json`) ne couvre que
21 cas. Ce script genere un corpus de cas HOSTILES — ceux qui font diverger une
implementation d'une autre — et verifie que le portage Kotlin reproduit
exactement les valeurs de l'implementation Python de reference.

Les cas ciblent les pieges reels rencontres ou imaginables :

- `İ` (I pointé turc) : `str.lower()` en Python et `toLowerCase()` en Java ne
  donnent pas le meme resultat.
- `ß` et `Ü` allemands : comportement de casse different entre langages.
- Emoji : une String Java est en UTF-16, un emoji y occupe deux `char`, alors
  que Python compte un point de code. `message_length` diverge alors de 1.
- Accents composes vs decomposes (`va\u0301lidez`).
- Caracteres zero-width, homoglyphes cyrilliques, CJK, arabe et hebreu (RTL).
- Raccourcisseurs et TLD :iekantique par suffixe, pas par egalite exacte.

Usage :

    # 1. Compiler le portage Kotlin (hors APK)
    kotlinc FeatureExtraction.kt FeatureParityCheck.kt -include-runtime -d /tmp/parity.jar

    # 2. Comparer
    python scripts/feature_parity.py --jar /tmp/parity.jar
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.feature_extraction import extract_features  # noqa: E402

ADVERSARIAL_TEXTS: dict[str, str] = {
    # --- casse : pieges inter-langages ---
    "turkish_dotted_i": "URGENT İSTİNEBİLİRİNİZİ DOĞRULAYIN",
    "turkish_lower_i": "ığdır şüphe ücretsiz",
    "german_eszett": "STRAßE ÜBER 100 € DRINGEND",
    "german_cap": "ÜBERPRÜFEN SIE IHRE KONTO",
    # --- accents composes / decomposes ---
    "compose_accent": "válidez votre compte",
    "decompose_accent": "va\u0301lidez votre compte",
    "mixed_decompose": "cliq\u0301uez vite",
    # --- homoglyphes et scripts ---
    "cyrillic_a": "vаlidez votre compte",
    "cyrillic_full": "привет как дела",
    "greek_mixed": "аpple Валенz",
    # --- zero-width ---
    "zwsp": "vali\u200bdez votre compte",
    "zwnj": "vali\u200cdez",
    "zwj": "vali\u200ddez",
    "word_joiner": "vali\u2060dez",
    "bom": "\ufeffurgent",
    # --- astral / emoji ---
    "emoji_single": "\U0001f600",
    "emoji_mix": "URGENT \U0001f600 \U0001F600",
    "flag_emoji": "\U0001F1EB\U0001F1F7 urgent",
    # --- RTL et non-latin ---
    "arabic": "عاجل الرجاء تأكيد الحساب",
    "hebrew": "דחוף אימות חשבון",
    "chinese": "紧急请验证您的账户",
    # --- URLs ---
    "url_www": "cliquez www.example.tk/offre",
    "url_upper": "cliquez HTTP://BIT.LY/ABC",
    "url_subdomain": "cliquez https://evil.bit.ly/x",
    "url_lookalike_host": "cliquez https://bitly.com/x",
    "url_tk_deep": "http://a.b.c.promo.tk/x?y=1",
    "url_port": "http://evil.tk:8080/x",
    "url_punycode": "http://xn--80ak6aa92e.com",
    "url_trailing_dot": "cliquez http://bit.ly/a3.",
    "url_ip": "http://192.168.1.100/verif",
    # --- negation : « bloque » ne matche pas « debloque » ---
    "debloque": "votre compte sera debloque",
    "debloquer": "il faut le debloquer vite",
    # --- evasion par separateurs ---
    "cliq_uez": "cliq-uez vite",
    "mot-de-passe": "mot-de-passe",
    "code-de-verif": "code-de-verification",
    "dotted_pin": "p.i.n svp",
    "spaced_out": "u r g e n t",
    # --- longueurs et repetition ---
    "long_600": "a" * 600,
    "many_excl": "urgent!!!! urgent!!!!",
    "digits_many": "123456789012345678901234567890",
    # --- espaces et trivia ---
    "spaces_only": "     ",
    "newlines": "urgent\n\n\nvite",
    "tabs": "urgent\t\tvite",
    "nbsp": "urgent\u00a0vite",
}


def build_corpus() -> dict[str, dict]:
    corpus: dict[str, dict] = {}
    for name, text in ADVERSARIAL_TEXTS.items():
        for known_bad in (None, True, False):
            key = f"{name}__{known_bad}"
            corpus[key] = {
                "text": text,
                "knownBadUrl": known_bad,
                "features": extract_features(text, known_bad_url=known_bad),
            }
    return corpus


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--jar",
        required=True,
        help="jar compile par kotlinc (FeatureExtraction.kt + FeatureParityCheck.kt)",
    )
    args = parser.parse_args()

    jar = Path(args.jar)
    if not jar.exists():
        print(f"jar introuvable : {jar}", file=sys.stderr)
        return 2

    corpus = build_corpus()

    # Les 21 vecteurs dores font partie de la comparaison : on les ajoute au
    # corpus pour qu'une seule commande couvre tout le contrat.
    golden_path = Path(__file__).resolve().parents[1] / "tests/fixtures/feature_vectors.json"
    golden = json.loads(golden_path.read_text(encoding="utf-8"))
    for case in golden["cases"]:
        if "text_repeat" in case:
            spec = case["text_repeat"]
            text = spec["unit"] * spec["count"]
        else:
            text = case["text"]
        key = f"golden_{case['name']}__{case['known_bad_url']}"
        corpus[key] = {
            "text": text,
            "knownBadUrl": case["known_bad_url"],
            "features": extract_features(text, known_bad_url=case["known_bad_url"]),
        }

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
        json.dump(corpus, fh, ensure_ascii=False, indent=2)
        corpus_path = fh.name

    result = subprocess.run(
        ["java", "-jar", str(jar), corpus_path],
        capture_output=True,
        text=True,
    )
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)

    expected_count = len(corpus)
    if f"{expected_count} cas verifies" not in result.stdout:
        print(
            f"\nATTENTION : le harnais Kotlin a reports moins de {expected_count} cas. "
            "Des cas ont ete ignores silencieusement — la parite n'est pas etablie.",
            file=sys.stderr,
        )
        return 1

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())