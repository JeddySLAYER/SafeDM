from app.utils.similarity_hash import compute_similarity_hash


def test_similarity_hash_is_stable_and_64_bit():
    value = compute_similarity_hash("URGENT cliquez ici https://example.test/a")
    assert value == compute_similarity_hash("urgent   cliquez ici https://example.test/b")
    assert len(value) == 16
    int(value, 16)


def test_empty_similarity_hash_is_explicit():
    assert compute_similarity_hash("   ") == "0000000000000000"
