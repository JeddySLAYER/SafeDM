"""Print migrated tables and seed counts."""

from sqlalchemy import inspect, text

from app.core.database import engine


def main() -> None:
    insp = inspect(engine)
    tables = sorted(insp.get_table_names())
    print(f"TABLES ({len(tables)})")
    for name in tables:
        print(f" - {name}")

    with engine.connect() as conn:
        apps = conn.execute(text("SELECT COUNT(*) FROM supported_applications")).scalar()
        cats = conn.execute(text("SELECT COUNT(*) FROM guide_categories")).scalar()
        arts = conn.execute(text("SELECT COUNT(*) FROM guide_articles")).scalar()
        print(f"seed apps={apps} categories={cats} articles={arts}")


if __name__ == "__main__":
    main()
