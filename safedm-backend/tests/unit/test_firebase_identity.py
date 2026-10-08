from app.services.firebase_auth import username_from_identity


def test_username_from_email():
    assert username_from_identity("Joan.Admin@example.com", "uid123456789") == "Joan_Admin"


def test_username_fallback_short():
    name = username_from_identity("a@x.io", "abcdefghijklmnop")
    assert name.startswith("fb_")
    assert len(name) >= 3
