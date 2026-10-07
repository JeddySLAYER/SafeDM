/** Map API severity / analysis status → design RiskBadge level. */
export function severityToLevel(severity) {
  switch ((severity || "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "low";
    default:
      return "unknown";
  }
}

export function statusToLevel(status, severity) {
  const s = (status || "").toUpperCase();
  if (s === "DANGEROUS") return "high";
  if (s === "SUSPICIOUS") return "medium";
  if (s === "SAFE") return "low";
  if (severity) return severityToLevel(severity);
  return "unknown";
}

export function riskHeadline(level) {
  switch (level) {
    case "high":
      return "RISQUE ÉLEVÉ";
    case "medium":
      return "RISQUE MOYEN";
    case "low":
      return "RISQUE FAIBLE";
    default:
      return "RISQUE INCONNU";
  }
}

export function riskDescription(level) {
  switch (level) {
    case "high":
      return "Ce message présente un risque élevé de malveillance.";
    case "medium":
      return "Ce message présente des signaux suspects. Restez prudent.";
    case "low":
      return "Aucun signal critique détecté, restez vigilant.";
    default:
      return "L’analyse est incomplète ou incertaine.";
  }
}

export function vtLabel(result) {
  switch ((result || "").toUpperCase()) {
    case "MALICIOUS":
      return "Lien malveillant";
    case "SUSPICIOUS":
      return "Lien suspect";
    case "CLEAN":
      return "Lien propre";
    default:
      return "Lien non vérifié";
  }
}
