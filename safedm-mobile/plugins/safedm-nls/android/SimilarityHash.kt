package com.safedmmobile.notifications

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Locale

/** Deterministic 64-bit SimHash; only the fingerprint leaves the device. */
object SimilarityHash {
  private const val SHINGLE_SIZE = 3

  fun compute(text: String): String {
    val normalized = text
      .lowercase(Locale.ROOT)
      .replace(Regex("https?://\\S+|www\\.\\S+", RegexOption.IGNORE_CASE), " <url> ")
      .replace(Regex("\\s+"), " ")
      .trim()
    val tokens = normalized.split(" ").filter { it.isNotEmpty() }
    if (tokens.isEmpty()) return "0000000000000000"

    val bits = IntArray(64)
    val shingles = if (tokens.size < SHINGLE_SIZE) {
      listOf(tokens.joinToString(" "))
    } else {
      (0..tokens.size - SHINGLE_SIZE).map { index ->
        tokens.subList(index, index + SHINGLE_SIZE).joinToString(" ")
      }
    }
    shingles.forEach { shingle ->
      val digest = MessageDigest.getInstance("SHA-256")
        .digest(shingle.toByteArray(StandardCharsets.UTF_8))
      for (bit in 0 until 64) {
        val set = (digest[bit / 8].toInt() and (1 shl (bit % 8))) != 0
        bits[bit] += if (set) 1 else -1
      }
    }
    var result = 0L
    for (bit in 0 until 64) {
      if (bits[bit] >= 0) result = result or (1L shl bit)
    }
    return result.toULong().toString(16).padStart(16, '0')
  }
}
