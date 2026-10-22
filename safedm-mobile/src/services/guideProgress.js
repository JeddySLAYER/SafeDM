import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Progression dans le guide (reflexes coches, resultat du quiz).
 *
 * Tout est local : la progression d'education n'a rien a faire sur un serveur,
 * et elle doit rester disponible hors ligne.
 */
const KEY = "safedm_guide_progress_v1";

const EMPTY = { checked: {}, quizScore: null, quizTotal: 0 };

async function read() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, checked: {} };
    const parsed = JSON.parse(raw);
    return {
      checked: parsed?.checked && typeof parsed.checked === "object" ? parsed.checked : {},
      quizScore: typeof parsed?.quizScore === "number" ? parsed.quizScore : null,
      quizTotal: Number(parsed?.quizTotal) || 0,
    };
  } catch {
    return { ...EMPTY, checked: {} };
  }
}

async function write(progress) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export async function getGuideProgress() {
  return read();
}

/** Coche / decoche un reflexe. Renvoie la progression mise a jour. */
export async function setReflexChecked(reflexId, checked) {
  const progress = await read();
  if (checked) {
    progress.checked[reflexId] = true;
  } else {
    delete progress.checked[reflexId];
  }
  await write(progress);
  return progress;
}

/** Memorise le resultat du quiz. */
export async function setQuizResult(score, total) {
  const progress = await read();
  progress.quizScore = score;
  progress.quizTotal = total;
  await write(progress);
  return progress;
}

/** Nombre de reflexes deja coches. */
export function countChecked(progress) {
  return Object.keys(progress?.checked || {}).length;
}
