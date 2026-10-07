package safedm.nls

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Parite bit-a-bit entre le runtime Kotlin et l'entraineur Python.
 *
 * Verifie le chemin complet sur un modele reel : 5299 mots de vocabulaire et un
 * `bucket` de 200 000, donc des collisions de hachage reellement exercees, plus
 * les cas qui ont casse les implementations intermediaires — accents, emoji,
 * tirets, mots hors vocabulaire, chaines vides, chaines blanches seules.
 *
 * La fixture est produite par `scripts/make_fasttext_fixture.py`, qui appelle
 * `app.ml.fasttext_runtime`. Si les deux implementations divergent, ce controle
 * echoue ; il ne peut pas echouer "par hasard", parce que les deux cotes
 * calculent le meme hash sur le meme texte.
 *
 * Lancement :
 *   kotlinc FastTextRuntime.kt FastTextRuntimeCheck.kt -include-runtime -d check.jar \
 *     -cp /tmp/json.jar
 *   java -cp check.jar:/tmp/json.jar safedm.nls.FastTextRuntimeCheckKt /tmp/ft_fixture.json
 */
fun main(args: Array<String>) {
    val path = args.getOrNull(0) ?: error("usage: FastTextRuntimeCheckKt <fixture.json>")
    val root = JSONObject(File(path).readText())

    val spec = FastTextRuntime.Spec(
        labels = root.getJSONArray("labels").toStringList(),
        words = root.getJSONArray("words").toStringList(),
        minn = root.getInt("minn"),
        maxn = root.getInt("maxn"),
        wordNgrams = root.getInt("wordNgrams"),
        bucket = root.getInt("bucket"),
        dim = root.getInt("dim"),
    )
    println("spec : ${spec.labels} | ${spec.nwords} mots | " +
        "minn=${spec.minn} maxn=${spec.maxn} wng=${spec.wordNgrams} bucket=${spec.bucket} dim=${spec.dim}")

    val inRows = HashMap<Int, IntArray>(root.getJSONObject("inRows").length() * 2)
    val obj = root.getJSONObject("inRows")
    for (key in obj.keys()) inRows[key.toInt()] = obj.getJSONArray(key).toIntArray()
    val outRowsJson = root.getJSONArray("outRows")
    val outRows = Array(outRowsJson.length()) { outRowsJson.getJSONArray(it).toIntArray() }

    val model = FastTextRuntime.Quantized(
        spec, inRows,
        root.getString("inScale").toDouble(),
        outRows,
        root.getString("outScale").toDouble(),
    )

    val threshold = root.getLong("threshold")
    println("seuil : $threshold")

    var failures = 0

    // Les n-grams doivent tomber dans l'espace de lignes, sinon un patch
    // addressing ces identifiants ne voudrait rien dire.
    if (spec.nwords <= 0) { println("KO nwords <= 0"); failures++ }
    if (root.getInt("bucket") <= spec.nwords) {
        println("KO bucket <= nwords : les deux espaces de lignes se recouvrent")
        failures++
    }

    val cases = root.getJSONArray("cases")
    for (i in 0 until cases.length()) {
        val c = cases.getJSONObject(i)
        val text = c.getString("text")
        val expectedRows = c.getJSONArray("rows").toIntArray()
        val actualRows = spec.lineRows(text)

        if (!actualRows.contentEquals(expectedRows)) {
            println("KO lignes  ${label(text)}")
            println("     attendu (${expectedRows.size}) : ${expectedRows.take(12)}")
            println("     obtenu  (${actualRows.size}) : ${actualRows.take(12)}")
            failures++
            continue
        }
        // Une ligne doit toujours exister dans l'espace (mots puis hachage).
        for (r in actualRows) {
            if (r < 0 || r >= spec.nwords + spec.bucket) {
                println("KO ligne hors bornes ${label(text)} : $r")
                failures++
                break
            }
        }

        val expectedScores = c.getJSONArray("scores").toIntArray()
        if (expectedScores.isEmpty()) {
            if (actualRows.isNotEmpty()) {
                println("KO abstention attendue mais ${actualRows.size} lignes produites ${label(text)}")
                failures++
            } else {
                println("ok  abstention              ${label(text)}")
            }
            continue
        }
        val actualScores = model.scores(actualRows)
        if (!actualScores.contentEquals(expectedScores)) {
            println("KO scores   ${label(text)}")
            println("     attendu : ${expectedScores.toList()}")
            println("     obtenu  : ${actualScores.toList()}")
            failures++
            continue
        }
        println("ok  lignes+scores (${actualRows.size} lignes)  ${label(text)}")

        // Le contrat qui compte pour l'utilisateur : pas les scores, mais le
        // verdict rendu. On compare l'issue du seuil et l'etiquette, donc une
        // erreur d'unite dans le score serait attrapee ici meme si les deux
        // cotés restaient coherents entre eux.
        val expectedAbstain = c.getBoolean("abstained")
        val idx = model.decision(actualRows, threshold)
        val abstained = idx == FastTextRuntime.ABSTAIN
        if (abstained != expectedAbstain) {
            println("KO abstention ${label(text)} : attendu ${if (expectedAbstain) "abstention" else "classement"}")
            failures++
        } else if (!abstained) {
            val expectedLabel = c.getString("label")
            val actualLabel = spec.labels[idx]
            if (actualLabel != expectedLabel) {
                println("KO etiquette  ${label(text)} : attendu $expectedLabel, obtenu $actualLabel")
                failures++
            } else {
                // La confiance est le seul flottant du chemin, donc la seule
                // valeur qui puisse diverger sans qu'on s'en apercoive aux
                // decisions. On la compare avec une tolerance large : le but
                // est de detecter un ordre de grandeur faux (le symptome de la
                // saturation a 1.0). Les deux cotes font le meme calcul
                // entier, donc le seul ecart possible vient de `exp`.
                // Note : la reference est le modele quantifie, pas les poids
                // flottants — l'erreur de quantification (~1e-4) n'est pas un bug.
                val actualConf = model.confidence(actualRows, idx)
                val expectedConf = c.getDouble("confidence")
                if (kotlin.math.abs(actualConf - expectedConf) > 1e-6) {
                    println("KO confiance ${label(text)} : attendu $expectedConf, obtenu $actualConf")
                    failures++
                } else {
                    println("ok  verdict ${actualLabel.removePrefix("__label__")} " +
                        "(confiance ${"%.4f".format(actualConf)})  ${label(text)}")
                }
            }
        } else {
            println("ok  abstention (aucun label au seuil)  ${label(text)}")
        }
    }

    // Le patchable : une ligne absente doit peser zero, sinon on ne peut pas
    // embarquer un sous-ensemble de lignes sans changer les scores.
    val probe = "validez votre compte sur http://banque.tk"
    val rows = spec.lineRows(probe)
    if (rows.isNotEmpty()) {
        val stripped = HashMap(inRows)
        var removed = 0
        for (r in rows.toList()) if (stripped.remove(r) != null) removed++
        if (removed == 0) {
            println("KO aucune ligne retirable : le test du patch creux ne teste rien")
            failures++
        } else {
            val partial = FastTextRuntime.Quantized(
                spec, stripped, model.inScale, model.outRows, model.outScale,
            )
            if (partial.scores(rows).contentEquals(model.scores(rows))) {
                println("KO retirer $removed lignes n'a rien change : le patch creux est inoperant")
                failures++
            } else {
                println("ok  patch creux : $removed lignes retirees, les scores changent")
            }
        }
    }

    println(if (failures == 0) "\nTOUT PASSE : Kotlin == Python, bit a bit" else "\n$failures ECHEC(S)")
    if (failures > 0) kotlin.system.exitProcess(1)
}

private fun label(text: String): String =
    if (text.length <= 46) "\"$text\"" else "\"${text.take(43)}...\" (${text.length} car.)"

private fun JSONArray.toStringList(): List<String> =
    (0 until length()).map { getString(it) }

private fun JSONArray.toIntArray(): IntArray =
    IntArray(length()) { getInt(it) }