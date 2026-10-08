/**
 * Le client de développement ouvre l'app avec l'adresse Metro du PC
 * (souvent http://192.168.x.x:8081). Ce n'est pas un lien à analyser.
 */
export function isIgnorableLaunchUrl(raw) {
  if (!raw) return true;
  const value = String(raw);
  if (/expo-development-client/i.test(value) || value.startsWith("exp+")) {
    return true;
  }
  let host = "";
  let port = "";
  try {
    const parsed = new URL(value);
    host = parsed.hostname;
    port = parsed.port;
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return true;
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return true;
  }
  if (port === "8081" || port === "19000" || port === "19006") return true;
  return false;
}
