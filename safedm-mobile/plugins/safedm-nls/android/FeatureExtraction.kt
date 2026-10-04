package com.safedmmobile.features

import java.text.Normalizer
import java.util.Locale
import java.util.Calendar
import java.util.TimeZone

/**
 * Extracteur de features V2 — portage Kotlin du contrat de reference Python.
 *
 * Source de verite : `safedm-backend/app/utils/feature_extraction.py`.
 * Vecteurs dores : `safedm-backend/tests/fixtures/feature_vectors.json`.
 *
 * Pourquoi ce portage vit dans le plugin natif et non dans le JS :
 *  1. C'est le `NotificationListenerService` qui voit chaque notification. Si
 *     l'extraction depend du bridge JS, elle rate tout ce qui arrive avant le
 *     demarrage du bundle, et bloque le thread JS a chaque SMS recu.
 *  2. `java.text.Normalizer` (NFKD) et `Character` donnent exactement ce que
 *     donne `unicodedata` en Python. Hermes n'offre pas la meme garantie sur les
 *     proprietes Unicode, et c'est precisement ce genre d'ecart qui avait rendu
 *     `all_caps_ratio` mort en Python.
 *  3. Un seul portage, donc une seule source de verite cote applicatif.
 *
 * Toute divergence avec Python doit etre corrigee dans les deux langages, ou
 * dans aucun.
 */
object FeatureExtraction {

    const val FEATURE_COUNT = 50

    /** Meme ordre que `FEATURE_NAMES` de feature_extraction.py ; le patch signe le verifie. */
    val FEATURE_NAMES: List<String> = listOf(
        "has_url",
        "url_count",
        "shortened_url",
        "ip_url",
        "punycode",
        "suspicious_tld",
        "non_https_url",
        "url_atypical_port",
        "deep_subdomain",
        "brand_in_subdomain",
        "url_host_digit_ratio",
        "url_userinfo",
        "url_query_count",
        "url_executable_extension",
        "url_hyphen_count",
        "known_bad_url",
        "urgency",
        "credentials",
        "sensitive",
        "payment",
        "threat",
        "imperative_cta",
        "crypto",
        "otp_code",
        "account_word",
        "bank_word",
        "delivery_word",
        "prize_word",
        "refund_word",
        "money_amount",
        "phone_number",
        "authority_claim",
        "urgency_count",
        "question_count",
        "first_person_pressure",
        "personal_salutation",
        "message_length",
        "exclamation_ratio",
        "all_caps_ratio",
        "digit_ratio",
        "obfuscation",
        "hour_off_hours",
        "is_weekend",
        "is_social_app",
        "notification_kind",
        "agg_urgency_index",
        "agg_link_risk",
        "agg_credential_pressure",
        "agg_social_engineering",
        "agg_total_risk",
    )
    const val FEATURE_KNOWN_BAD_URL = 15

    /** « pas verifie » : ni sur ni malveillant, le modele ne doit pas trancher. */
    const val UNKNOWN_KNOWN_BAD_URL = 128

    private const val MAX_UINT8 = 255
    private const val LENGTH_SATURATION = 512

    // Ecrits en echappement Unicode explicite, et non en litteraux : un caractere
    // zero-width colle dans un fichier source est invisible a la relecture et se
    // corrompt silencieusement dans un editeur.
    private val ZERO_WIDTH = setOf(
        '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF',
    )

    private val CYRILLIC_HOMOGLYPHS = setOf('а', 'е', 'о', 'р', 'с', 'у', 'х', 'і', 'ј')
    private val LATIN_LOOKALIKES = setOf(
        'a', 'e', 'o', 'p', 'x', 'y', 'i', 'j',
    )

    private val OTP_KEYWORDS = listOf(
    "code de verification",
    "code de securite",
    "code otp",
    "otp",
    "jeton de securite",
    "code a 4 chiffres",
    "code a 6 chiffres",
    "authentification a deux facteurs",
)

private val ACCOUNT_KEYWORDS = listOf(
    "votre compte",
    "mon compte",
    "compte client",
    "compte utilisateur",
    "espace client",
    "area client",
    "votre profil",
)

private val BANK_KEYWORDS = listOf(
    "banque",
    "bancaire",
    "rib",
    "virement",
    "compte bancaire",
    "releve bancaire",
    "coiffe",
    "credit",
)

private val DELIVERY_KEYWORDS = listOf(
    "colis",
    "livraison",
    "expedition",
    "suivi de commande",
    "numero de suivi",
    "coursier",
    "douane",
)

private val PRIZE_KEYWORDS = listOf(
    "gagne",
    "winner",
    "loterie",
    "concours",
    "prize",
    "cadeau",
    "gratuit",
    "million",
)

private val REFUND_KEYWORDS = listOf(
    "remboursement",
    "rembourse",
    "avoir",
    "trop paye",
    "rembours",
    "reimbursement",
)

private val AUTHORITY_KEYWORDS = listOf(
    "officiel",
    "officielle",
    "service client",
    "assistance",
    "support officiel",
    "equipe",
    "securite",
    "confidentiel",
)

private val PRESSURE_KEYWORDS = listOf(
    "vous devez",
    "il faut",
    "vous etes oblige",
    "il est obligatoire",
    "sous peine",
    "avant 24h",
    "sous 24 heures",
    "derniere chance",
    "dernier avertissement",
    "ne pas ignorer",
)

private val KNOWN_BRANDS = listOf(
    "paypal", "visa", "mastercard", "banque", "bnpc", "sgb",
    "orange", "mtn", "moov", "whatsapp", "facebook", "instagram",
    "google", "apple", "microsoft", "amazon", "free", "sfr", "bouygues",
)

private val EXECUTABLE_EXTENSIONS = listOf(
    ".apk", ".exe", ".msi", ".apkdownload", ".jar", ".bat", ".dmg",
)

private val SOCIAL_APP_MARKERS = listOf(
    "whatsapp", "telegram", "messenger", "instagram", "facebook",
    "signal", "viber", "snapchat",
)

private val URL_USERINFO_REGEX =
    Regex("""^[a-z][a-z0-9+.\-]*://[^/@\s]+@""", RegexOption.IGNORE_CASE)

// `\s` ne couvre pas l espace insecable ; on l ajoute explicitement, sinon un
// montant ecrit « 1 234,56 euros » avec des insecables passe inapercu.
private val MONEY_AMOUNT_REGEX = Regex(
    """(?:\d[\s\u00a0.,]*){1,3}(?:\s*(?:euros?|eur|francs?|fcp|dollars?|usd|dh|dirhams?))""",
    RegexOption.IGNORE_CASE,
)

// Au moins 7 groupes de chiffres : un numero de telephone. Un code OTP de 4
// chiffres ne matche pas, et reste donc traite comme ce qu'il est.
private val PHONE_REGEX = Regex("""(?:\+?\d[\s.\-]*){7,}""")

private val ATYPICAL_PORT_REGEX = Regex(""":(\d{2,5})(?=$|[/?#\s])""")

private val URGENCY_KEYWORDS = listOf(
        "urgent", "urgence", "immediat", "immediate", "tout de suite",
        "sous 24h", "24 heures", "dernier avertissement", "ultime",
        "expire", "expiration", "avant minuit", "limited", "bientot",
    )

    private val CREDENTIAL_KEYWORDS = listOf(
        "mot de passe", "password", "identifiant", "login", "connexion",
        "otp", "code de verification", "code de confirmation", "code pin",
        "pin", "jeton", "token", "authentification",
    )

    private val SENSITIVE_KEYWORDS = listOf(
        "rib", "iban", "carte bancaire", "numero de carte", "cvv", "cvc",
        "securite sociale", "numero de carte bancaire", "piece d'identite",
        "nationalite", "date de naissance", "solde", "numero de compte",
    )

    private val PAYMENT_KEYWORDS = listOf(
        "transfert", "transferer", "envoyer", "envoyez", "paiement", "payer",
        "reglez", "regler", "frais", "depot", "deposez", "recharge",
        "credit", "avance", "commission", "taxe", "frais de livraison",
    )

    // Les formes a prefixe de negation sont explicites : « bloque » ne matche
    // pas « debloque » a cause de la frontiere de mot, et « votre compte sera
    // debloque » est la formulation type du phishing bancaire francophone.
    private val THREAT_KEYWORDS = listOf(
        "bloque", "bloquee", "bloquer", "bloquez", "suspendu", "suspendue",
        "suspendre", "ferme", "fermee", "desactive", "desactivee", "annule",
        "annulee", "resilie", "confisque", "penalite", "amende",
        "mise en demeure", "poursuite", "cloture", "debloque", "debloquee",
        "debloquer", "debloquez", "reactive", "reactivez", "reactivation",
        "desactivez", "annulez", "renouvelez",
    )

    private val IMPERATIVE_CTAS = listOf(
        "cliquez", "clique", "validez", "valider", "confirmez", "confirmer",
        "composez", "repondez", "repondre", "appelez", "telechargez",
        "installez", "ouvrez", "acceptez", "autorisez", "renouvelez",
        "connectez",
    )

    private val CRYPTO_WORDS = listOf("usdt", "bitcoin", "wallet", "crypto", "btc")

    private val PERSONAL_SALUTATIONS = listOf(
        "cher client", "chere cliente", "cher monsieur", "chere madame",
        "madame", "monsieur", "cher abonne", "chere abonnee", "cher utilisateur",
    )

    private val SHORTENER_HOSTS = listOf(
        "bit.ly", "tinyurl.com", "t.co", "ow.ly", "is.gd", "buff.ly",
        "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc",
    )

    private val SUSPICIOUS_TLDS = listOf(
        ".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".xyz", ".click",
        ".link", ".work", ".rest", ".loan", ".buzz", ".monster",
    )

    private val URL_REGEX =
        Regex("""(?:https?://|www\.)[^\s<>"']+""", RegexOption.IGNORE_CASE)

    private val IPV4_REGEX = Regex("""\b(?:\d{1,3}\.){3}\d{1,3}\b""")

    private val HOST_REGEX =
        Regex("""^(?:https?://)?(?:[^@/]+@)?([^/?#:]+)""", RegexOption.IGNORE_CASE)

    // Frontiere de mot portable : pas de lookbehind.
    //
    // Python utilise `(?:^|[^a-z0-9])`, et non un `(?<![a-z0-9])`, pour que les
    // deux langages partagent exactement le meme motif. Le lookahead final, lui,
    // est universellement supporte. Le caractere de tete est consomme, mais
    // comme on teste chaque mot-cle separement (`containsWord`) et qu'on ne
    // compte que la presence, deux mots-cles adjacents sont toujours detectes.
    private const val INTERNAL_SEPARATOR = "[-'*_.]*"
    private const val SPACE_SEPARATORS = "[\\s\\-*'_]+" 

    // ---------------------------------------------------------------- texte

    /** Minuscules + diacritiques retires + espaces tasse. */
    private fun normalize(text: String): String =
        squeezeSpaces(stripAccents(text).lowercase(Locale.ROOT))

    /** Diacritiques retires, casse d'origine conservee (pour `all_caps`). */
    private fun fold(text: String): String = squeezeSpaces(stripAccents(text))

    private fun stripAccents(text: String): String {
        val decomposed = Normalizer.normalize(text, Normalizer.Form.NFKD)
        val out = StringBuilder(decomposed.length)
        for (ch in decomposed) {
            // NON_SPACING_MARK = categorie Unicode Mn, l'equivalent Java de
            // `unicodedata.combining(ch) != 0` pour l'essentiel des caracteres
            // accentues latins.
            if (Character.getType(ch).toInt() != Character.NON_SPACING_MARK.toInt()) {
                out.append(ch)
            }
        }
        return out.toString()
    }

    private fun squeezeSpaces(text: String): String =
        text.replace(Regex("\\s+"), " ").trim()

    // ------------------------------------------------------------- motifs

    /**
     * Recherche par frontiere de mot, insensible aux separateurs internes.
     *
     * `cliq-uez` matche « cliquez », `mot-de-passe` matche « mot de passe ».
     * Les separateurs internes n'incluent pas l'espace : sinon « p in » serait
     * lu comme « pin ».
     */
    private fun containsWord(text: String, needle: String): Boolean {
        if (needle.isEmpty()) return false
        val body = buildString {
            for (ch in needle) {
                if (ch == ' ') {
                    // Un espace du mot-cle devient « un ou plusieurs separateurs ».
                    append(SPACE_SEPARATORS)
                } else {
                    append(INTERNAL_SEPARATOR)
                    append(Regex.escape(ch.toString()))
                }
            }
        }
        return Regex("""(?:^|[^a-z0-9])$body(?![a-z0-9])""").containsMatchIn(text)
    }

    private fun extractUrls(text: String): List<String> =
        URL_REGEX.findAll(text).map { it.value }.toList()

    private fun hostOf(url: String): String {
        val match = HOST_REGEX.find(url) ?: return ""
        return match.groupValues[1].lowercase(Locale.ROOT)
    }

    /** `host` se termine-t-il par l'un des suffixes ? « promo.tk » finit par « .tk ». */
    private fun hostEndsWithAny(host: String, suffixes: List<String>): Boolean =
        suffixes.any { host.endsWith(it) }

    /**
     * Nombre de POINTS DE CODE, pas de `char`.
     *
     * Une String Java/Kotlin est en UTF-16 : un emoji occupe deux `char`, alors
     * que Python compte un seul caractere. Sans cette precaution,
     * `message_length` vaut 2 au lieu de 1 pour un emoji, et la feature diverge
     * entre les deux implementations — exactement le piege que ce portage doit
     * eviter.
     */
    private fun codePointCount(text: String): Int = text.codePointCount(0, text.length)

    private fun countCodePoints(text: String, predicate: (Char) -> Boolean): Int {
        var n = 0
        var i = 0
        while (i < text.length) {
            val cp = text.codePointAt(i)
            val ch = Character.toChars(cp)
            if (predicate(ch[0])) n++
            i += Character.charCount(cp)
        }
        return n
    }

    private fun scale(count: Int, cap: Int): Int {
        if (cap <= 0) return 0
        val clamped = count.coerceIn(0, cap)
        return (clamped.toLong() * MAX_UINT8).toInt() / cap
    }

    /**
     * Nombre de mots-cles DISTINCTS presents, plafonne a [cap].
     *
     * Compter des occurrences confondrait « il a ecrit un SMS sur l'urgence »
     * et « il a repete urgence urgence », qui relevent de l'heuristique
     * editoriale, pas du signal de menace.
     */
    private fun keywordCount(text: String, keywords: List<String>, cap: Int): Int {
        val hits = keywords.count { containsWord(text, it) }
        return minOf(hits, cap)
    }

    /** Nombre de labels avant le TLD. « a.b.exemple.tk » -> 3. */
    private fun subdomainDepth(host: String): Int {
        val trimmed = host.trimEnd('.')
        return maxOf(0, trimmed.count { it == '.' })
    }

    /** Part de chiffres dans l'hote. Un nom de domaine legitime en est pauvre. */
    private fun hostDigitRatio(hosts: List<String>): Int {
        val joined = hosts.joinToString("")
        val digits = countCodePoints(joined) { it.isDigit() }
        return 255 * digits / maxOf(1, codePointCount(joined))
    }

    /**
     * Port explicite dans l'URL. `:80` et `:443` sont normaux ; tout autre port
     * dans un SMS pointe vers un service inhabituel.
     */
    private fun hasAtypicalPort(url: String): Boolean {
        val match = ATYPICAL_PORT_REGEX.find(url) ?: return false
        return match.groupValues[1] != "80" && match.groupValues[1] != "443"
    }

    /** Moyenne entiere tronquee : `round()` varie selon l'arrondi des flottants. */
    private fun meanOf(vararg values: Int): Int = values.sum() / values.size

    /**
     * Type d'application encode en 0/85/170/255.
     *
     * Un booleen « est-ce une app sociale » perdrait l'information qui compte :
     * un SMS de banque et un WhatsApp n'appartiennent pas au meme circuit de
     * confiance.
     */
    private fun notificationKind(packageName: String): Int {
        val lowered = packageName.lowercase(Locale.ROOT)
        if (lowered.contains("com.android.mms") || lowered.contains("messaging") ||
            lowered.contains("sms")
        ) return 0
        if (lowered.contains("whatsapp")) return 85
        if (lowered.contains("gmail") || lowered.contains("mail") ||
            lowered.contains("outlook") || lowered.contains("mailorange")
        ) return 170
        return 255
    }

    /**
     * Bloc CONTEXT. 128 = « pas observe », 0 = « observe et neutre ».
     *
     * L'absence de donnee ne doit pas ressembler a une donnee negative : sinon
     * un message analyse sans horodatage paraitrait « en plein jour » et le
     * modele lui accorderait une confiance qu'on n'a pas.
     *
     * UTC et non l'heure locale : l'heure du telephone est un choix de
     * l'utilisateur, pas une propriete du message. Utiliser l'heure locale
     * rendrait le vecteur dependant du fuseau et casserait l'agregation
     * communautaire. Python fait la meme chose, volontairement.
     *
     * `java.time` exige l'API 26 alors que `minSdk` est ~24 : on passe par
     * `Calendar`, disponible partout.
     */
    private fun contextFeatures(postTimeMs: Long?, packageName: String?): List<Int> {
        val offHours: Int
        val weekend: Int
        if (postTimeMs == null) {
            offHours = UNKNOWN_KNOWN_BAD_URL
            weekend = UNKNOWN_KNOWN_BAD_URL
        } else {
            val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.ROOT)
            calendar.timeInMillis = postTimeMs
            offHours = if (calendar.get(Calendar.HOUR_OF_DAY) in 8 until 20) 0 else MAX_UINT8
            weekend = if (calendar.get(Calendar.DAY_OF_WEEK) >= Calendar.SATURDAY) MAX_UINT8 else 0
        }

        if (packageName.isNullOrBlank()) {
            return listOf(offHours, weekend, UNKNOWN_KNOWN_BAD_URL, UNKNOWN_KNOWN_BAD_URL)
        }
        val social = SOCIAL_APP_MARKERS.any { packageName.lowercase(Locale.ROOT).contains(it) }
        return listOf(offHours, weekend, if (social) MAX_UINT8 else 0, notificationKind(packageName))
    }

    /**
     * Cinq features AGREGEES, comme le plan les exige.
     *
     * Ce n'est pas de la redondance : avec un petit jeu d'entrainement, une
     * regression logistique n'apprend pas seule les interactions (« URL +
     * credentials » est bien plus suspecteux que chacun pris isolement). Donner
     * ces combinaisons au modele, c'est la difference entre generaliser et
     * memoriser.
     */
    private fun aggregateFeatures(f: IntArray): List<Int> {
        val urgency = meanOf(f[16], f[18], f[17], f[37], f[38])
        val link = meanOf(f[2], f[3], f[5], f[8], f[9])
        val credential = meanOf(f[17], f[18], f[23], f[24], f[25])
        val social = meanOf(f[35], f[21], f[30], f[33])
        val total = meanOf(urgency, link, credential, social)
        return listOf(urgency, link, credential, social, total)
    }

    private fun hasObfuscation(text: String): Boolean {
        if (text.any { it in ZERO_WIDTH }) return true
        val hasCyrillic = text.any { it in CYRILLIC_HOMOGLYPHS }
        val hasLatinLookalike = text.lowercase(Locale.ROOT).any { it in LATIN_LOOKALIKES }
        return hasCyrillic && hasLatinLookalike
    }

    // ------------------------------------------------------------ extracteur

    /**
     * Calcule les [FEATURE_COUNT] features en uint8, dans l'ordre du schema.
     *
     * @param urls passe par l'appelant si deja extraits, pour eviter un second
     *   parcours du message.
     * @param knownBadUrl `null` = non verifie, la feature vaut 128.
     */
    @JvmOverloads
    fun extract(
        text: String,
        urls: List<String>? = null,
        knownBadUrl: Boolean? = null,
        postTimeMs: Long? = null,
        packageName: String? = null,
    ): IntArray {
        val norm = normalize(text)
        // `folded` garde la casse : mesurer les majuscules sur `norm` donnerait
        // toujours 0, et la feature serait morte.
        val folded = fold(text)
        val resolvedUrls = urls ?: extractUrls(norm)
        val hosts = resolvedUrls.map { hostOf(it) }

        val f = IntArray(FEATURE_COUNT)

        // ---------------- LIENS (0-15) ----------------
        f[0] = if (resolvedUrls.isNotEmpty()) MAX_UINT8 else 0
        f[1] = scale(resolvedUrls.size, 8)
        f[2] = if (hosts.any { hostEndsWithAny(it, SHORTENER_HOSTS) }) MAX_UINT8 else 0
        f[3] = if (resolvedUrls.any { IPV4_REGEX.containsMatchIn(it) }) MAX_UINT8 else 0
        f[4] = if (hosts.any { it.startsWith("xn--") }) MAX_UINT8 else 0
        f[5] = if (hosts.any { hostEndsWithAny(it, SUSPICIOUS_TLDS) }) MAX_UINT8 else 0
        // `http://` est le defaut historique des campagnes ; `https` reste rare
        // dans un SMS, donc sa presence est faiblement suspecte et son absence
        // neutre.
        f[6] = scale(resolvedUrls.count { it.lowercase(Locale.ROOT).startsWith("http://") }, 4)
        f[7] = scale(resolvedUrls.count { hasAtypicalPort(it) }, 2)
        f[8] = scale(hosts.maxOfOrNull { subdomainDepth(it) } ?: 0, 5)
        // Marque dans le sous-domaine alors que la profondeur est >= 2 :
        // signature de typosquatting (« paypal.secure-verif.tk »).
        f[9] = if (hosts.any { subdomainDepth(it) >= 2 && KNOWN_BRANDS.any { b -> it.contains(b) } }) MAX_UINT8 else 0
        f[10] = hostDigitRatio(hosts)
        f[11] = if (resolvedUrls.any { URL_USERINFO_REGEX.containsMatchIn(it) }) MAX_UINT8 else 0
        f[12] = scale(resolvedUrls.sumOf { url -> url.count { it == '?' } }, 3)
        f[13] = if (resolvedUrls.any {
                EXECUTABLE_EXTENSIONS.any { ext -> trimUrl(it).endsWith(ext) }
            }) MAX_UINT8 else 0
        f[14] = scale(hosts.maxOfOrNull { h -> h.count { it == '-' } } ?: 0, 6)

        // Reseau : derniere du bloc pour que les 15 premieres soient toutes
        // decidables hors ligne.
        f[15] = when (knownBadUrl) {
            null -> UNKNOWN_KNOWN_BAD_URL
            true -> MAX_UINT8
            false -> 0
        }

        // ---------------- TEXTUELLES (16-36) ----------------
        f[16] = scale(keywordCount(norm, URGENCY_KEYWORDS, 8), 8)
        f[17] = scale(keywordCount(norm, CREDENTIAL_KEYWORDS, 8), 8)
        f[18] = scale(keywordCount(norm, SENSITIVE_KEYWORDS, 8), 8)
        f[19] = scale(keywordCount(norm, PAYMENT_KEYWORDS, 8), 8)
        f[20] = scale(keywordCount(norm, THREAT_KEYWORDS, 8), 8)
        f[21] = if (keywordCount(norm, IMPERATIVE_CTAS, 4) > 0) MAX_UINT8 else 0
        f[22] = if (CRYPTO_WORDS.any { containsWord(norm, it) }) MAX_UINT8 else 0
        f[23] = scale(keywordCount(norm, OTP_KEYWORDS, 4), 4)
        f[24] = if (keywordCount(norm, ACCOUNT_KEYWORDS, 4) > 0) MAX_UINT8 else 0
        f[25] = if (keywordCount(norm, BANK_KEYWORDS, 4) > 0) MAX_UINT8 else 0
        f[26] = if (keywordCount(norm, DELIVERY_KEYWORDS, 4) > 0) MAX_UINT8 else 0
        f[27] = if (keywordCount(norm, PRIZE_KEYWORDS, 4) > 0) MAX_UINT8 else 0
        f[28] = if (keywordCount(norm, REFUND_KEYWORDS, 4) > 0) MAX_UINT8 else 0
        f[29] = if (MONEY_AMOUNT_REGEX.containsMatchIn(norm)) MAX_UINT8 else 0
        f[30] = if (PHONE_REGEX.containsMatchIn(norm)) MAX_UINT8 else 0
        f[31] = if (keywordCount(norm, AUTHORITY_KEYWORDS, 4) > 0) MAX_UINT8 else 0
        // Comptage et non booleen : la repetition d'un signal est elle-meme un
        // indice d'echelle, absent d'un simple present/absent.
        f[32] = scale(keywordCount(norm, URGENCY_KEYWORDS, 12), 12)
        f[33] = scale(countCodePoints(norm) { it == '?' }, 6)
        f[34] = if (keywordCount(norm, PRESSURE_KEYWORDS, 4) > 0) MAX_UINT8 else 0
        f[35] = if (PERSONAL_SALUTATIONS.any { containsWord(norm, it) }) MAX_UINT8 else 0
        f[36] = scale(codePointCount(norm), LENGTH_SATURATION)

        // ---------------- TYPOGRAPHIQUES (37-40) ----------------
        f[37] = scale(countCodePoints(norm) { it == '!' }, 5)

        val letters = countCodePoints(folded) { Character.isLetter(it) }
        val upperLetters = countCodePoints(folded) { Character.isLetter(it) && Character.isUpperCase(it) }
        f[38] = scale(upperLetters, maxOf(1, letters))

        f[39] = scale(countCodePoints(norm) { it.isDigit() }, maxOf(1, codePointCount(norm)))
        f[40] = if (hasObfuscation(text)) MAX_UINT8 else 0

        // ---------------- CONTEXTUELLES (41-44) ----------------
        for (i in 0 until 4) f[41 + i] = contextFeatures(postTimeMs, packageName)[i]

        // ---------------- AGREGEES (45-49) ----------------
        val aggregates = aggregateFeatures(f)
        for (i in 0 until 5) f[45 + i] = aggregates[i]

        return f
    }

    /**
     * Enleve la ponctuation de fin d'URL.
     *
     * « http://bit.ly/a3. » avec la ponctuation de la phrase ferait echouer la
     * detection d'extension `.apk` : `rstrip` suffit car ces caracteres ne
     * peuvent pas faire partie d'un nom de fichier legitime.
     */
    private fun trimUrl(url: String): String =
        url.trimEnd('.', ',', ';', ')', '\\', '"', '\'')

}