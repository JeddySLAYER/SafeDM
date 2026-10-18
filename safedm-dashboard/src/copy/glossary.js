export const ML_STATUS_LABELS = {
  succeeded: "Réussi",
  failed: "Échoué",
  running: "En cours",
  pending: "En attente",
};

export const REVIEW_STATUS_LABELS = {
  approved: "Approuvé",
  rejected: "Rejeté",
  pending: "En attente",
};

export const BINARY_LABELS = {
  BENIN: "Bénin",
  MALVEILLANT: "Malveillant",
  DANGEREUX: "Malveillant",
  INCERTAIN: "Incertain",
};

export const LINK_DECISION_LABELS = {
  ALLOW: "Autorisé",
  WARN: "Avertissement",
  BLOCK: "Bloqué",
};

export function mlStatus(status) {
  return ML_STATUS_LABELS[status] || status || "—";
}

export function reviewStatus(status) {
  return REVIEW_STATUS_LABELS[status] || status || "En attente";
}

export function binaryLabel(value) {
  return BINARY_LABELS[value] || value || "—";
}
