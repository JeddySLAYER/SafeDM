import com.safedmmobile.features.FeatureExtraction
import java.io.File

/**
 * Harnais de test differentiel Python <-> Kotlin.
 *
 * A NE PAS shipping dans l'APK : c'est un outil de developpement.
 * Verification : voir `safedm-backend/scripts/feature_parity.py`.
 */
fun main(argv: Array<String>) {
    val json = File(argv[0]).readText()
    var failures = 0
    var checked = 0
    val entry = Regex("\"([A-Za-z0-9_.-]+)\"\\s*:\\s*\\{").findAll(json)
    for (m in entry) {
        val name = m.groupValues[1]
        val blockStart = m.range.last + 1
        val blockEnd = json.indexOf("\n  }", blockStart)
        val block = json.substring(blockStart, if (blockEnd > 0) blockEnd else json.length)
        val raw = Regex("\"text\"\\s*:\\s*\"(.*?)\"\\s*,").find(block)?.groupValues?.get(1) ?: continue
        val text = unescape(raw)
        val kb = when {
            Regex("\"knownBadUrl\"\\s*:\\s*true").containsMatchIn(block) -> true
            Regex("\"knownBadUrl\"\\s*:\\s*false").containsMatchIn(block) -> false
            else -> null
        }
        val expected = Regex("\"features\"\\s*:\\s*\\[([^]]*)\\]").find(block)?.groupValues?.get(1)
            ?.split(",")?.mapNotNull { it.trim().toIntOrNull() } ?: continue
        // Le bloc CONTEXT (heure, week-end, application) ne peut pas rester non
        // teste : 4 features sur 50 dependent de ces parametres, et c'est
        // precisement la partie ou les deux langages divergent facilement
        // (fuseau horaire, API Calendar vs datetime).
        val postTime = Regex("\"postTimeMs\"\\s*:\\s*(-?\\d+)").find(block)
            ?.groupValues?.get(1)?.toLongOrNull()
        val pkg = Regex("\"packageName\"\\s*:\\s*\"(.*?)\"").find(block)?.groupValues?.get(1)
            ?.takeIf { it.isNotEmpty() }
        val actual = FeatureExtraction.extract(
            text,
            knownBadUrl = kb,
            postTimeMs = postTime,
            packageName = pkg,
        ).toList()
        checked++
        if (actual != expected) {
            failures++
            println("ECHEC $name")
            println("  attendu ${expected.joinToString(",")}")
            println("  obtenu  ${actual.joinToString(",")}")
        }
    }
    println("$checked cas verifies, $failures echecs")
    if (failures > 0) System.exit(1)
}

/** Decode les echappements JSON. Sans ca, "\\n" comparait a un vrai saut de ligne. */
fun unescape(s: String): String {
    val out = StringBuilder(s.length)
    var i = 0
    while (i < s.length) {
        val c = s[i]
        if (c == '\\' && i + 1 < s.length) {
            when (s[i + 1]) {
                'n' -> { out.append('\n'); i += 2 }
                't' -> { out.append('\t'); i += 2 }
                'r' -> { out.append('\r'); i += 2 }
                'b' -> { out.append('\b'); i += 2 }
                'f' -> { out.append('\u000C'); i += 2 }
                '"' -> { out.append('"'); i += 2 }
                '\\' -> { out.append('\\'); i += 2 }
                'u' -> {
                    if (i + 6 > s.length) { out.append(c); i++ }
                    else {
                        val hex = s.substring(i + 2, i + 6)
                        out.append(hex.toInt(16).toChar())
                        i += 6
                    }
                }
                else -> { out.append(c); i++ }
            }
        } else {
            out.append(c); i++
        }
    }
    return out.toString()
}
