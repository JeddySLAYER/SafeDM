package com.safedmmobile.features

import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import org.json.JSONObject

/**
 * Legacy fallback de menace local : decision hors ligne, sans reseau.
 *
 * Le chemin officiel du Sprint 2 est TFLite via react-native-fast-tflite et
 * recoit le vecteur V3 de 50 features. Cette implementation signee n'est pas
 * utilisee pour declarer l'inference TFLite valide ; elle reste isolee pour
 * compatibilite avec les patches historiques.
 *
 * ## Implementation historique
 *
 * Le plan initial prevoyait TFLite. Ce n'est pas le bon outil ici :
 *
 *  - le modele est `sigmoid(w.x + b)` sur 50 entiers. TFLite apporte un
 *    interpreteur de graphes de plusieurs mega-octets pour 50 multiplications ;
 *  - TFLite accumule en `float32`, ce qui casse le contrat de determinisme : deux
 *    plateformes peuvent differer au dixieme et changer le niveau affiche ;
 *  - un `.tflite` est un artefact versionne par le runtime, pas par nous : on ne
 *    peut pas garantir qu'il produise les memes sorties dans cinq ans.
 *
 * Le contrat V3 impose des `uint8` et une parite bit-a-bit Python/Kotlin. Des
 * poids entiers dans un JSON lisible, signable et diffable etaient le format
 * historique de ce fallback.
 *
 * ## Format du patch
 *
 * ```json
 * {
 *   "model_version": 1,
 *   "status": "production",
 *   "feature_names": [...50...],
 *   "golden_fixture_sha256": "...",
 *   "quantization": {"weights": [...], "weight_scale": 10000,
 *                    "threshold_score": 9500, "intercept": 0},
 *   "canary_percent": 5,
 *   "signature": "3045..."   // ECDSA P-256 / SHA-256, DER
 * }
 * ```
 *
 * Le `signature` couvre le patch *sans* le champ `signature` lui-meme, canons
 * de trie des cles compris, pour que Python et KotlinWnd hashent exactement la
 * meme chaine.
 *
 * ## Echec ferme
 *
 * Toute verification qui echoue laisse le modele absent, ce qui fait retomber
 * l'app sur l'heuristique de secours. Aucun chemin ne « devine » des poids.
 */
class LocalThreatModel private constructor(
    val weights: IntArray,
    val thresholdScore: Int,
    val modelVersion: Int,
    private val canaryPercent: Int,
) {

    /**
     * Score entier. Les features sont des `uint8` (0..255) et les poids des
     * entiers a l'echelle 10 000, donc le produit tient largement dans un `Int`
     * : 255 * 10 000 * 50 = 127 500 000, loin de l'overflow.
     *
     * Cette fonction doit reproduire `score_from_quantized()` de
     * `scripts/train_local_model.py` au bit pres.
     */
    fun score(features: IntArray): Int {
        require(features.size == weights.size) {
            "taille de vecteur ${features.size} != ${weights.size} attendus"
        }
        var total = 0
        for (i in features.indices) total += weights[i] * features[i]
        return total
    }

    /** Decision du modele. `false` signifie « rien de concluant », pas « sain ». */
    fun isMalicious(features: IntArray): Boolean = score(features) >= thresholdScore

    /**
     * Canary deterministe : 5% des messages passent par le modele, le reste par
     * l'heuristique.
     *
     * Le tirage est derive du vecteur, pas d'un `Random` : le meme message
     * tombe toujours dans le meme bras, donc un bug de canary est reproductible
     * et un rollback ne depend pas de l'ordre d'arrivee. Le point d'entree est
     * un entier, pas un hachage de 128 bits dont on prendrait les premiers bits —
     * un hackage de la table de canary donnerait le meme comportement a tous les
     * utilisateurs, ce qui est utile pour une experience, mais ici on veut de la
     * repartition.
     */
    fun isInCanary(features: IntArray): Boolean {
        if (canaryPercent <= 0) return false
        if (canaryPercent >= 100) return true
        return (stableBucket(features) % 100) < canaryPercent
    }

    fun stableBucket(features: IntArray): Int {
        var hash = 17
        for (value in features) hash = hash * 31 + value
        return hash and 0x7FFFFFFF
    }

    companion object {
        /**
         * Empreinte du vecteur de 160 bits, SHA-256 tronque a 128 bits.
         *
         * Une `String` Java est en UTF-16 ; on convertit donc chaque `int` en
         * un octet explicite. Le resultat doit etre identique a
         * `hashlib.sha256(bytes(features))` en Python.
         */
        fun vectorHash(features: IntArray): String {
            val digest = MessageDigest.getInstance("SHA-256")
            digest.update(ByteArray(features.size) { index -> features[index].toByte() })
            val hash = digest.digest()
            val out = StringBuilder(32)
            for (i in 0 until 16) { // 16 octets = 128 bits
                val value = hash[i].toInt() and 0xFF
                out.append(HEX[value ushr 4]).append(HEX[value and 0x0F])
            }
            return out.toString()
        }

        /** Variante tolerante : retourne `null` au lieu de lever sur vecteur invalide. */
        fun vectorHashOrNull(features: IntArray?): String? {
            if (features == null) return null
            return try {
                vectorHash(features)
            } catch (e: Exception) {
                null
            }
        }

        private val HEX = "0123456789abcdef".toCharArray()

        /**
         * Verifie et charge un patch.
         *
         * @param json le patch recu du serveur (ou lu en local au premier lancement)
         * @param publicKeyHex cle publique ECDSA P-256 non compressee, X9.62
         *   (65 octets, commence par `04`), embarquee dans l'APK.
         * @return le modele pret, ou `null` si quoi que ce soit cloche.
         */
        fun load(json: String, publicKeyHex: String, canaryOverridePercent: Int? = null): LocalThreatModel? =
            loadOrReason(json, publicKeyHex, canaryOverridePercent).first

        /**
         * Comme [load], mais expose POURQUOI le chargement a echoue.
         *
         * Un `null` sans raison est un piege de maintenance : la seule facon de
         * distinguer « signature invalide » de « statut research » est
         * d'instrumenter le code. Chaque verification retourne donc son motif,
         * ce qui rend le refus auto-explicite dans les tests et dans les logs.
         */
        fun loadOrReason(
            json: String,
            publicKeyHex: String,
            canaryOverridePercent: Int? = null,
        ): Pair<LocalThreatModel?, String> {
            return try {
                val root = JSONObject(json)

                // 1. Signature d'abord. Valider le contenu avant la signature
                //    laisserait un attaquant modifier `threshold_score` a
                //    vontade puis de faire verifier le patch modifie — c'est le
                //    piege classique de l'ordre des verifications.
                val signatureHex = root.optString("signature", "")
                if (signatureHex.isEmpty()) return (null to "signature absente")

                val signatureBytes = hexToBytes(signatureHex) ?: return (null to "signature illisible")
                val payload = canonical(root)

                val verifier = Signature.getInstance("SHA256withECDSA")
                val derBytes = sp2der(publicKeyHex) ?: return (null to "cle publique invalide")
                val keySpec = X509EncodedKeySpec(derBytes)
                val publicKey = KeyFactory.getInstance("EC").generatePublic(keySpec)
                verifier.initVerify(publicKey)
                verifier.update(payload.toByteArray(Charsets.UTF_8))
                if (!verifier.verify(signatureBytes)) return (null to "signature invalide")

                // 2. Statut. Un patch signe par notre cle reste non
                //    deployable si l'entrainement n'a pas franchi nos seuils.
                if (root.optString("status", "") != "production") return (null to "statut ${root.optString("status", "")} != production")

                // 3. Le patch doit viser exactement NOTRE contrat de features.
                //    Sans cette verification, un patch signe pour 19 features
                //    s'appliquerait silencieusement en decalant tous les index.
                val names = root.getJSONArray("feature_names")
                if (names.length() != FeatureExtraction.FEATURE_NAMES.size) return (null to "${names.length()} features != ${FeatureExtraction.FEATURE_NAMES.size}")
                for (i in 0 until names.length()) {
                    if (names.getString(i) != FeatureExtraction.FEATURE_NAMES[i]) return (null to "feature $i : ${names.getString(i)} != ${FeatureExtraction.FEATURE_NAMES[i]}")
                }

                val quantization = root.getJSONObject("quantization")
                val rawWeights = quantization.getJSONArray("weights")
                if (rawWeights.length() != FeatureExtraction.FEATURE_NAMES.size) return (null to "${rawWeights.length()} poids != ${FeatureExtraction.FEATURE_NAMES.size}")
                val weights = IntArray(rawWeights.length()) { rawWeights.getInt(it) }

                val canary = canaryOverridePercent ?: root.optInt("canary_percent", 0)
                LocalThreatModel(
                    weights = weights,
                    thresholdScore = quantization.getInt("threshold_score"),
                    modelVersion = root.optInt("model_version", 0),
                    canaryPercent = canary,
                ) to "ok"
            } catch (e: Exception) {
                // Echec ferme : pas de modele plutot qu'un modele douteux.
                null to "exception ${e.javaClass.simpleName}: ${e.message}"
            }
        }

        /**
         * Recompose la chaine exacte signee par Python.
         *
         * `JSONObject` ne garantit ni l'ordre des cles ni le formatage des
         * nombres, donc on reconstruit a la main : cles triees, separateur `: `
         * sans espace, `null` explicite. Toute divergence ici ferait echouer
         * toute verification — ce qui est le comportement voulu en cas de
         * changement de format, plutot qu'une verification silencieusement fausse.
         */
fun canonical(root: JSONObject): String {
            val keys = root.keys().asSequence().filter { it != "signature" }.sorted().toList()
            val pieces = keys.map { key ->
                val value = root.get(key)
                val rendered = when (value) {
                    is JSONObject -> canonical(value)
                    else -> JSONObject.valueToString(value)
                }
                "\"$key\":$rendered"
            }
            return pieces.joinToString(",", prefix = "{", postfix = "}")
        }

        private fun hexToBytes(hex: String): ByteArray? {
            if (hex.length % 2 != 0) return null
            return try {
                ByteArray(hex.length / 2) { index ->
                    ((hex[index * 2].digitToInt(16) shl 4) or hex[index * 2 + 1].digitToInt(16)).toByte()
                }
            } catch (e: IllegalArgumentException) {
                null
            }
        }

        /**
         * Convertit une cle publique X9.62 non compressee (65 octets, prefixe
         * `04`) en SubjectPublicKeyInfo DER — le seul format que
         * `X509EncodedKeySpec` accepte sur Android.
         */
        private fun sp2der(publicKeyHex: String): ByteArray? {
            val raw = hexToBytes(publicKeyHex) ?: return null
            if (raw.size != 65 || raw[0] != 0x04.toByte()) return null

            // SEQUENCE { SEQUENCE { OID ecPublicKey, OID prime256v1 }, BIT STRING }
            val header = byteArrayOf(
                0x30, 0x59,
                0x30, 0x13,
                0x06, 0x07, 0x2A, 0x86.toByte(), 0x48, 0xCE.toByte(), 0x3D, 0x02, 0x01,
                0x06, 0x08, 0x2A.toByte(), 0x86.toByte(), 0x48, 0xCE.toByte(), 0x3D, 0x03, 0x01, 0x07,
                0x03, 0x42, 0x00,
            )
            return header + raw
        }
    }
}
