"""Seed guide CMS (catégories + articles de base).

Usage:
    python -m scripts.seed_guide
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import GuideArticle, GuideCategory

GUIDE_SEED = [
    {
        "title": "Reconnaître le phishing",
        "description": "Identifier les tentatives d'hameçonnage par message.",
        "display_order": 1,
        "articles": [
            {
                "title": "Signes d'un message de phishing",
                "display_order": 1,
                "content": (
                    "Méfiez-vous des messages qui créent un sentiment d'urgence, "
                    "demandent des informations personnelles ou contiennent des liens "
                    "inattendus. Vérifiez toujours l'expéditeur et ne cliquez pas "
                    "avant d'avoir validé la source."
                ),
            },
            {
                "title": "Que faire face à un lien suspect",
                "display_order": 2,
                "content": (
                    "Ne cliquez pas sur le lien. Ne répondez pas au message. "
                    "Utilisez l'analyse manuelle SafeDM pour évaluer le contenu, "
                    "puis signalez-le si le risque est confirmé."
                ),
            },
        ],
    },
    {
        "title": "Bonnes pratiques",
        "description": "Habitudes pour réduire le risque au quotidien.",
        "display_order": 2,
        "articles": [
            {
                "title": "Ne jamais partager de codes ou mots de passe",
                "display_order": 1,
                "content": (
                    "Aucune banque, opérateur ou service légitime ne vous demandera "
                    "un mot de passe ou un code OTP par WhatsApp, SMS ou e-mail non sollicité."
                ),
            },
        ],
    },
]


def seed_guide() -> None:
    db = SessionLocal()
    try:
        for cat_data in GUIDE_SEED:
            category = db.scalar(
                select(GuideCategory).where(GuideCategory.title == cat_data["title"])
            )
            if not category:
                category = GuideCategory(
                    title=cat_data["title"],
                    description=cat_data["description"],
                    display_order=cat_data["display_order"],
                )
                db.add(category)
                db.flush()
                print(f"  create category: {category.title}")
            else:
                category.description = cat_data["description"]
                category.display_order = cat_data["display_order"]
                print(f"  update category: {category.title}")

            for art_data in cat_data["articles"]:
                article = db.scalar(
                    select(GuideArticle).where(
                        GuideArticle.category_id == category.id,
                        GuideArticle.title == art_data["title"],
                    )
                )
                if not article:
                    db.add(
                        GuideArticle(
                            category_id=category.id,
                            title=art_data["title"],
                            content=art_data["content"],
                            display_order=art_data["display_order"],
                            is_published=True,
                        )
                    )
                    print(f"    create article: {art_data['title']}")
                else:
                    article.content = art_data["content"]
                    article.display_order = art_data["display_order"]
                    article.is_published = True
                    print(f"    update article: {art_data['title']}")

        db.commit()
        print("Seed guide terminé.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_guide()
