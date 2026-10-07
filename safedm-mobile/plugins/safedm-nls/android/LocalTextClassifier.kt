package safedm.nls

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * Classifieur fastText embarque, entier, hors ligne.
 *
 * Cycle de vie : le modele est un asset d'APK, charge une seule fois au premier
 * message puis mis en cache. S'il est absent ou invalide, on **s'abstient** —
 * on ne substitue jamais une heuristique en degrading silencieusement, parce
 * que le JS ne saurait pas distinguer « pas de modele » de « modele dit non ».
 *
 * L'abstention est donc une troisieme issue, distincte de `SAFE` : c'est ce qui
 * permet de livrer le code avant d'avoir un corpus francais honnete, sans
 * pretendre a une precision que personne n'a mesuree.
 *
 * Le contenu du message ne sort jamais de l'appareil : ici on le lit, on le
 * normalise, et on ne conserve que le vecteur de n-grams puis le verdict.
 */
object LocalTextClassifier {

    private const val ASSET = "safedm_fasttext_model.json"
    private const val CACHE = "safedm_fasttext_cache.json"

    private var cached: Loaded? = null
    private var tried = false

    /** Un modele charge + son empreinte, pour tracer la version en base. */
    data class Loaded(
        val model: FastTextRuntime.Quantized,
        val threshold: Long,
        val version: String,
        val contentHash: String,
    )

    /**
     * Verdict rendu au JS. [label] vide = abstention, et c'est le seul cas ou
     * l'UI doit se rabattre sur son heuristique historique.
     */
    class Verdict(
        val label: String,
        val confidence: Double,
        val version: String,
    ) {
        val abstained: Boolean get() = label.isEmpty()
    }

    private fun load(context: Context): Loaded? {
        cached?.let { return it }
        if (tried) return null
        tried = true
        return try {
            // L'asset d'abord : il est dans le APK et verifie a l'installation.
            // Le cache local n'est accepte que s'il passe la meme empreinte que
            // l'asset, ce qui rend un cache corrompu ou downgrade inoperant.
            val raw = readAsset(context) ?: return null
            val parsed = parse(raw) ?: return null
            val allowed = assetHash(context)
            val actual = contentHash(raw)
            if (allowed != null && allowed != actual) {
                android.util.Log.w("SafeDMClassifier", "cache local refuse : empreinte divergente")
                return null
            }
            cached = parsed.copy(contentHash = actual)
            cached
        } catch (t: Throwable) {
            android.util.Log.w("SafeDMClassifier", "modele indisponible: ${t.javaClass.simpleName}")
            null
        }
    }

    private fun readAsset(context: Context): String? = try {
        context.assets.open(ASSET).bufferedReader().use { it.readText() }
    } catch (t: Throwable) {
        null
    }

    private fun assetHash(context: Context): String? = try {
        context.assets.open(ASSET).use { s ->
            val d = MessageDigest.getInstance("SHA-256")
            val buf = ByteArray(8192)
            while (true) {
                val n = s.read(buf)
                if (n <= 0) break
                d.update(buf, 0, n)
            }
            d.digest().joinToString("") { "%02x".format(it) }
        }
    } catch (t: Throwable) {
        null
    }

    private fun contentHash(raw: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(raw.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    /**
     * Format de l'asset : `in_rows` est un objet sparse indexe par numero de
     * ligne. C'est exactement la forme d'un patch, donc un patch et un modele
     * complet partagent le meme code de lecture et la meme verification de
     * signature.
     */
    private fun parse(raw: String): Loaded? {
        val root = JSONObject(raw)
        val spec = root.getJSONObject("spec")
        val labels = spec.getJSONArray("labels").let { a ->
            (0 until a.length()).map { a.getString(it) }
        }
        val words = root.getJSONArray("words").let { a ->
            (0 until a.length()).map { a.getString(it) }
        }
        val ftSpec = FastTextRuntime.Spec(
            labels = labels,
            words = words,
            minn = spec.getInt("minn"),
            maxn = spec.getInt("maxn"),
            wordNgrams = spec.getInt("wordNgrams"),
            bucket = spec.getInt("bucket"),
            dim = spec.getInt("dim"),
        )
        val outJson = root.getJSONArray("out_rows")
        val outRows = Array(outJson.length()) { i ->
            val a = outJson.getJSONArray(i)
            IntArray(a.length()) { a.getInt(it) }
        }
        val inJson = root.getJSONObject("in_rows")
        val inRows = HashMap<Int, IntArray>(inJson.length() * 2)
        for (key in inJson.keys()) {
            val a = inJson.getJSONArray(key)
            inRows[key.toInt()] = IntArray(a.length()) { a.getInt(it) }
        }
        return Loaded(
            model = FastTextRuntime.Quantized(
                spec = ftSpec,
                inRows = inRows,
                inScale = root.getString("in_scale").toDouble(),
                outRows = outRows,
                outScale = root.getString("out_scale").toDouble(),
            ),
            threshold = root.getLong("threshold"),
            version = root.optString("version", "unknown"),
            contentHash = "",
        )
    }

    /**
     * Point d'entree unique, appele par le listener.
     *
     * Ne leve jamais : une exception ici ferait perdre l'alerte, ce qui est le
     * pire resultat possible pour un systeme de securite. Le contenu brut n'est
     * conserve nulle part au-dela de l'appel.
     */
    fun classify(context: Context, text: String): Verdict = try {
        val loaded = load(context)
        if (loaded == null || text.isBlank()) {
            Verdict("", 0.0, "none")
        } else {
            val rows = loaded.model.spec.lineRows(text)
            val idx = loaded.model.decision(rows, loaded.threshold)
            if (idx == FastTextRuntime.ABSTAIN) {
                Verdict("", 0.0, loaded.version)
            } else {
                Verdict(
                    label = loaded.model.spec.labels[idx].removePrefix("__label__"),
                    confidence = loaded.model.confidence(rows, idx),
                    version = loaded.version,
                )
            }
        }
    } catch (t: Throwable) {
        android.util.Log.w("SafeDMClassifier", "classement impossible: ${t.javaClass.simpleName}")
        Verdict("", 0.0, "error")
    }

    /** Permet a un test hors Android de reinjecter un modele deja parse. */
    fun installForTest(loaded: Loaded?) {
        cached = loaded
        tried = true
    }
}