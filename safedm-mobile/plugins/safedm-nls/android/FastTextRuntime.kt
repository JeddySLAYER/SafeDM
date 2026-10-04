package safedm.nls

/**
 * Inference fastText supervisee, en arithmetique entiere, sans dependance native.
 *
 * Pourquoi reimplementer fastText plutot que l'embarquer
 * -------------------------------------------------------
 * En mode supervise, fastText n'est pas un reseau profond : son inference est
 *
 *     hidden = mean(W_in[lignes du texte])
 *     score  = sigmoid(W_out . hidden)
 *
 * un modele lineaire sur un sac de n-grams. On peut donc l'ecrire en entiers,
 * comme la regression logistique entiere deja retenue pour le modele local
 * precedent. Ce qu'on gagne, et qui est l'objet du projet :
 *
 *  - aucun runtime de graphes de plusieurs Mo dans l'APK ;
 *  - un contrat de determinisme **bit-a-bit** entre l'entraineur Python et
 *    l'appareil. C'est ce qui permet a un patch signe de prevoir exactement ce
 *    que l'appareil va faire ;
 *  - des poids **patchables ligne par ligne** : un patch est un dictionnaire
 *    sparse `{ligne -> vecteur}`, pas un blob opaque versionne par fastText.
 *
 * Le runtime tient en une centaine de lignes et n'a aucune dependance.
 *
 * Les cinq pieges d'exactitude
 * ----------------------------
 * Chacun a ete decouvert en comparant aux bindings C++ de la bibliotheque, et
 * chacun a un test dedie dans `FastTextRuntimeCheck.kt`. Les quatre premiers ne
 * se voient pas sur de l'ASCII : ils apparaissent des le premier accent, donc
 * ils sont invisibles avec un jeu de tests anglais — et le francais est precisement
 * la langue cible.
 *
 * 1. **FNV-1a sign-etendu.** `Dictionary::hash` fait `h ^= uint32_t(int8_t(o))`.
 *    Pour un octet >= 0x80, l'extension de signe occupe les **32 bits**, pas
 *    seulement les 8 bas. Un `h xor octet` naif change le hash de tout texte
 *    accentue.
 *
 * 2. **N-grams par caractere UTF-8.** `computeSubwords` avance de caractere
 *    complet et compte `n` en caracteres. Decouper en octets puis decoder en
 *    `errors="ignore"` avale l'octet de continuation et fabrique des n-grams
 *    dechires.
 *
 * 3. **Decalage de lignes.** Les lignes mots occupent `[0, nwords)`, les lignes
 *    de hachage occupent `[nwords, nwords + bucket)`. Confondre les deux donne
 *    un modele qui compile, passe un test de smoke, et classe au hasard.
 *
 * 4. **Word-n-grams sur int32 negatif.** Les hachages sont stockes dans un
 *    `vector<int32_t>` : une valeur >= 2^31 y devient negative, et
 *    `uint64_t h = hashes[i]` la reconvertit par **extension de signe sur
 *    64 bits**. Avec la valeur non negative, le resultat change pour la moitie
 *    des mots.
 *
 * 5. **Un sigmoid par label, pas un softmax.** L'inference fastText applique un
 *    sigmoid independant a chaque label, meme pour un modele multi-classe
 *    entraine en `loss="softmax"` (le softmax ne sert qu'au gradient).
 *    Consequence utile ici : deux labels peuvent depasser 0.5 en meme temps,
 *    ce qui est exactement ce qu'on veut pour « phishing + identifiants ». Un
 *    softmax aurait impose `somme(p) == 1` et aurait interdit ce cas.
 *
 * Piege connexe, cote entrainement : `fasttext.predict()` est **inexploitable**
 * dans `fasttext-wheel==0.9.2` — il renvoie des probabilites **superieures a 1**
 * et classe differemment de la formule ci-dessus (0.9776 contre 0.9919 sur le
 * meme corpus). Aucun seuil ne doit donc etre cale sur cette fonction ; la
 * reference de l'entraineur est `Model.test`.
 */
object FastTextRuntime {

    private const val FNV_OFFSET = 2166136261L
    private const val FNV_PRIME = 16777619L
    private const val FT_NGRAM_COMBINE = 116049371L
    private const val BOW = '<'
    private const val EOW = '>'
    const val EOS = "</s>"

    /**
     * Separateurs reconnus par `Dictionary::readWord`. Ce ne sont pas les memes
     * que `String.split()` par defaut : Java/Kotlin coupent aussi sur des
     * espaces Unicode (insecable, fine...) que fastText considere comme des
     * caracteres ordinaire. Diverger ici change le nombre de mots, donc toutes
     * les lignes, donc le score.
     */
    private val WHITESPACE = charArrayOf(
        ' ', '\t', '\n', '\r', '\u000B', '\u000C', '\u0000',
    )

    /** fastText `Dictionary::hash` — FNV-1a 32 bits, octets sign-etendus. */
    @JvmStatic
    fun ftHash(text: String): Int {
        var h = FNV_OFFSET
        for (byte in text.toByteArray(Charsets.UTF_8)) {
            // Kotlin : `Byte` est deja signe et `toLong()` fait l'extension de
            // signe sur 32 bits — exactement le `uint32_t(int8_t(o))` de fastText.
            h = (h xor byte.toLong()) and 0xFFFFFFFFL
            h = (h * FNV_PRIME) and 0xFFFFFFFFL
        }
        return h.toInt()
    }

    /**
     * fastText `Dictionary::computeSubwords` — n-grams de BOW+word+EOW.
     *
     * On itere sur les caracteres UTF-8 : `Char` est deja un caractere, donc on
     * avance de 1 en 1 sans passer par des octets. Le caractere de bord est
     * exclu (`n == 1 && (i == 0 || j == size)`), sans effet quand `minn >= 2`
     * mais conserve pour rester fidele si `minn` vaut un jour 1.
     */
    @JvmStatic
    fun computeSubwords(word: String, minn: Int, maxn: Int): List<String> {
        if (maxn <= 0) return emptyList()
        // On indexe par **point de code**, pas par unite UTF-16 : `String.length`
        // et `substring` comptent les moities de surrogate, donc un emoji
        // compterait pour deux caracteres et ses n-grams seraient decales.
        val cps = word.codePoints().toArray()
        val size = cps.size
        val out = ArrayList<String>()
        for (i in 0 until size) {
            for (n in 1..maxn) {
                val j = i + n
                if (j > size) break
                if (n >= minn && !(n == 1 && (i == 0 || j == size))) {
                    out.add(codePointsToString(cps, i, j))
                }
            }
        }
        return out
    }

    private fun codePointsToString(cps: IntArray, from: Int, to: Int): String {
        val sb = StringBuilder(to - from)
        for (k in from until to) sb.appendCodePoint(cps[k])
        return sb.toString()
    }

    /**
     * Tout ce dont l'inference a besoin, et rien de plus.
     *
     * `words` donne l'ordre exact des lignes mots : l'index dans cette liste est
     * l'identifiant de ligne. Ne pas reconstruire cet ordre ailleurs, c'est lui
     * qui definit l'identite des patches.
     */
    class Spec(
        @JvmField val labels: List<String>,
        @JvmField val words: List<String>,
        @JvmField val minn: Int,
        @JvmField val maxn: Int,
        @JvmField val wordNgrams: Int,
        @JvmField val bucket: Int,
        @JvmField val dim: Int,
    ) {
        val nwords: Int get() = words.size

        private val wordRows: Map<String, Int> by lazy {
            HashMap<String, Int>(words.size * 2).also { m ->
                for (i in words.indices) m[words[i]] = i
            }
        }

        /**
         * Piege n°3 : ligne de matrice d'un n-gram = `nwords + hash % bucket`.
         *
         * Le modulo doit porter sur la valeur **non signee**. `ftHash` rend un
         * `Int` — comme le `int32_t` de fastText — donc negatif pour la moitie
         * des hachages, alors que Python calcule sur un entier non signe et
         * reste positif. `Math.floorMod` *renormaliserait* au lieu de
         * convertir : il faut repasser par l'unsigned explicitement.
         */
        fun bucketRow(ngram: String): Int =
            nwords + (Integer.toUnsignedLong(ftHash(ngram)) % bucket.toLong()).toInt()

        fun subwordRows(token: String): IntArray {
            val grams = computeSubwords("$BOW$token$EOW", minn, maxn)
            val out = IntArray(grams.size)
            for (i in grams.indices) out[i] = bucketRow(grams[i])
            return out
        }

        /**
         * fastText `Dictionary::getLine` pour une ligne de prediction.
         *
         * - un mot **hors vocabulaire** apporte bien ses n-grams (sans ligne
         *   mot) : c'est tout l'interet des char n-grams, un mot mal orthographe
         *   doit quand meme produire un signal ;
         * - la ligne se termine par `</s>`, qui n'apporte que sa propre ligne
         *   mais dont le hash entre dans les word-n-grams : le dernier bigram est
         *   `(dernier_mot, </s>)` ;
         * - `</s>` n'est ajoute que si au moins un mot a ete lu. Sur une entree
         *   vide fastText s'abstient ; l'ajouter quand meme ferait passer une
         *   notification vide pour un mot connu, donc pour un faux positif.
         */
        fun lineRows(text: String): IntArray {
            val rows = ArrayList<Int>(256)
            val wordHashes = ArrayList<Int>(32)
            for (token in splitTokens(text)) {
                val wid = wordRows[token] ?: -1
                if (wid >= 0) {
                    rows.add(wid)
                    if (maxn > 0) for (r in subwordRows(token)) rows.add(r)
                    wordHashes.add(ftHash(token))
                } else if (token != EOS) {
                    for (r in subwordRows(token)) rows.add(r)
                    wordHashes.add(ftHash(token))
                }
                if (token == EOS) return finish(rows, wordHashes)
            }
            return finish(rows, wordHashes)
        }

        /** `readWord` : coupe sur les seuls separateurs ASCII de fastText. */
        private fun splitTokens(text: String): List<String> {
            if (text.isEmpty()) return emptyList()
            val out = ArrayList<String>()
            val cur = StringBuilder()
            for (ch in text) {
                if (WHITESPACE.contains(ch)) {
                    if (cur.isNotEmpty()) {
                        out.add(cur.toString())
                        cur.setLength(0)
                    }
                } else {
                    cur.append(ch)
                }
            }
            if (cur.isNotEmpty()) out.add(cur.toString())
            return out
        }

        private fun finish(rows: ArrayList<Int>, wordHashes: ArrayList<Int>): IntArray {
            if (wordHashes.isEmpty()) return IntArray(0)
            val eosWid = wordRows[EOS] ?: -1
            if (eosWid >= 0) {
                rows.add(eosWid)
                wordHashes.add(ftHash(EOS))
            }
            for (r in wordNgramRows(wordHashes)) rows.add(r)
            return rows.toIntArray()
        }

        /**
         * fastText `Dictionary::addWordNgrams` — hachage glissant 116049371.
         *
         * Piege n°4 : les hachages vivent dans un `vector<int32_t>`, donc une
         * valeur >= 2^31 y est negative, et l'affectation en `uint64_t` la
         * reconvertit par extension de signe sur 64 bits. Le `Long` de Kotlin
         * porte exactement les memes bits — seule la **division** doit se faire
         * en non signee, d'ou `remainderUnsigned`.
         */
        private fun wordNgramRows(wordHashes: List<Int>): IntArray {
            if (wordNgrams <= 1) return IntArray(0)
            val out = ArrayList<Int>(wordHashes.size)
            for (i in wordHashes.indices) {
                var h = wordHashes[i].toLong()
                for (j in i + 1 until minOf(wordHashes.size, i + wordNgrams)) {
                    h = h * FT_NGRAM_COMBINE + wordHashes[j].toLong()
                    out.add(nwords + java.lang.Long.remainderUnsigned(h, bucket.toLong()).toInt())
                }
            }
            return out.toIntArray()
        }
    }

    /**
     * Modele entier deploye. Les lignes absentes de [inRows] comptent zero : c'est
     * ce qui rend le patch sparse possible, on n'embarque que les lignes
     * reellement rencontrees et pas les 200 000 de `W_in`.
     */
    class Quantized(
        @JvmField val spec: Spec,
        @JvmField val inRows: Map<Int, IntArray>,
        @JvmField val inScale: Double,
        @JvmField val outRows: Array<IntArray>,
        @JvmField val outScale: Double,
    ) {
        /**
         * Scores bruts, non normalises par les echelles : la normalisation se fait
         * au moment du seuil, pour rester entier de bout en bout.
         */
        fun scores(rows: IntArray): IntArray {
            val dim = spec.dim
            val acc = IntArray(dim)
            for (r in rows) {
                val row = inRows[r] ?: continue
                for (d in 0 until dim) acc[d] += row[d]
            }
            val out = IntArray(outRows.size)
            val n = rows.size.coerceAtLeast(1)
            for (l in outRows.indices) {
                val qrow = outRows[l]
                // Long obligatoire : `acc[d]` peut atteindre 130 * 127 et
                // `qrow[d]` 32767, soit 5.4e8 par dimension ; sur dim = 16 on
                // deborde l'Int32.
                var total = 0L
                for (d in 0 until dim) total += acc[d].toLong() * qrow[d].toLong()
                out[l] = clampToInt(total / n)
            }
            return out
        }

        /**
         * Label retenu, ou [ABSTAIN] si aucun ne franchit [threshold].
         *
         * Une comparaison d'entiers et non un `sigmoid` : sur l'appareil on a
         * besoin d'une decision, pas d'une probabilite, et un flottant
         * reintroduirait exactement le risque de divergence qu'on a elimine.
         */
        fun decision(rows: IntArray, threshold: Long): Int {
            if (rows.isEmpty()) return ABSTAIN
            val s = scores(rows)
            var best = ABSTAIN
            var bestScore = Long.MIN_VALUE
            for (l in s.indices) {
                if (s[l].toLong() > bestScore) {
                    bestScore = s[l].toLong()
                    best = l
                }
            }
            return if (best != ABSTAIN && bestScore >= threshold) best else ABSTAIN
        }

        /**
         * Confiance du modele, pour l'affichage seulement.
         *
         * Le score de [scores] est un entier **quantifie** : le rendre reel, c'est
         * le multiplier par les deux echelles. Diviser les mettrait a l'echelle
         * inverse et donnerait des logit de l'ordre de 1e10, donc un sigmoid
         * sature a 1.0 pour n'importe quel message — une confiance qui affiche
         * « 1.0000 » en permanence et ne distingue plus rien.
         *
         * C'est aussi pour cela que la decision de [decision] reste une
         * comparaison entiere : elle ne depend d'aucun flottant, donc elle est
         * reproductible bit a bit sur n'importe quel appareil.
         */
        fun confidence(rows: IntArray, labelIndex: Int): Double {
            if (rows.isEmpty()) return 0.0
            val factor = inScale * outScale
            val z = scores(rows)[labelIndex].toDouble() * factor
            return 1.0 / (1.0 + Math.exp(-z))
        }

        private fun clampToInt(v: Long): Int = when {
            v > Int.MAX_VALUE -> Int.MAX_VALUE
            v < Int.MIN_VALUE -> Int.MIN_VALUE
            else -> v.toInt()
        }
    }

    /** Aucun label ne franchit le seuil : on ne classe pas, on ne devine pas. */
    const val ABSTAIN = -1
}