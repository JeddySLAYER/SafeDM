import com.safedmmobile.features.LocalThreatModel
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

fun main(args: Array<String>) {
    val argv = args + arrayOf("/tmp/patches/test_production.json", "/tmp/patches/tampered_status.json")
    val patchJson = File(argv[0]).readText()
    val publicKey = File(argv[1]).readText().trim()
    var fails = 0
    fun check(label: String, ok: Boolean, detail: String = "") {
        if (ok) println("  OK    $label") else { fails++; println("  ECHEC $label  $detail") }
    }

    println("== chargement et statut ==")
    for (f in listOf(argv[0], argv[3], argv[4])) {
        val (m, why) = LocalThreatModel.loadOrReason(File(f).readText(), publicKey)
        println("   ${File(f).name}: ${if (m == null) "REFUSE" else "accepte"} — $why")
    }
    check("statut 'research' refuse malgre signature valide", LocalThreatModel.load(patchJson, publicKey) == null)
    val promoted = File(argv[3]).readText()
    val model = LocalThreatModel.load(promoted, publicKey)
    check("statut 'production' + signature valide accepte", model != null)
    if (model == null) { println("ABANDON : impossible de continuer"); return }
    check("model_version == 1", model.modelVersion == 1, "obtenu ${model.modelVersion}")
    check("canary a 5%", model.isInCanary(IntArray(20)) == (model.stableBucket(IntArray(20)) % 100 < 5))

    println("== signature et integrite ==")
    check("statut modifie apres signature refuse",
        LocalThreatModel.load(File(argv[4]).readText(), publicKey) == null)
    check("cle publique etrangere refusee", LocalThreatModel.load(promoted, "04" + "11".repeat(64)) == null)
    check("seuil falsifie refuse",
        LocalThreatModel.load(promoted.replace(Regex("\"threshold_score\": \\d+"), "\"threshold_score\": 1"), publicKey) == null)
    check("patch sans signature refuse",
        LocalThreatModel.load(promoted.replace(Regex(",?\\s*\"signature\": \"[^\"]*\""), ""), publicKey) == null)
    check("nom de feature altere refuse",
        LocalThreatModel.load(promoted.replace("\"shortened_url\"", "\"shortened_URL\""), publicKey) == null)
    check("taille de vecteur alteree refusee",
        LocalThreatModel.load(promoted.replace(Regex("\"canary_percent\": \\d+"), "\"canary_percent\": 7"), publicKey) == null)

    println("== parite avec Python (hash, score, decision) ==")
    val array = JSONArray(File(argv[2]).readText())
    var hashFails = 0; var scoreFails = 0; var n = 0
    for (i in 0 until array.length()) {
        val row = array.getJSONObject(i)
        val arr = row.getJSONArray("features")
        val features = IntArray(arr.length()) { arr.getInt(it) }
        n++
        if (LocalThreatModel.vectorHash(features) != row.getString("hash")) {
            hashFails++
            if (hashFails <= 2) println("    hash ${row.getString("name")}: py=${row.getString("hash")} kt=${LocalThreatModel.vectorHash(features)}")
        }
        if (model.score(features) != row.getInt("score")) scoreFails++
        if (model.isMalicious(features) != row.getBoolean("malicious")) scoreFails++
    }
    check("SHA-256 128 bits sur $n vecteurs", hashFails == 0, "$hashFails ecarts")
    check("score entier + decision sur $n vecteurs", scoreFails == 0, "$scoreFails ecarts")

    println("== garde-fous ==")
    check("vecteur de mauvaise taille refuse", runCatching { model.score(IntArray(5)) }.isFailure)
    check("vectorHashOrNull(null) == null", LocalThreatModel.vectorHashOrNull(null) == null)

    println(if (fails == 0) "\nTOUT PASSE" else "\n$fails ECHEC(S)")
    if (fails > 0) System.exit(1)
}
