export const colors = {
  blue50: "#EAF3FE",
  blueSoft: "#F0F7FF",
  blue200: "#B8D7FA",
  bluePrimary: "#2F8AF2",
  blue600: "#1D6FD1",
  blue800: "#14549E",
  white: "#FFFFFF",
  black: "#000000",
  section: "#FFFFFF",
  surface: "#F7F9FC",
  border: "#E5E7EB",
  textSecondary: "#666666",
  textMuted: "#98A2B3",
  textPrimary: "#111111",
  risk: {
    low: { fg: "#FFFFFF", bg: "#12B76A", label: "Faible" },
    medium: { fg: "#FFFFFF", bg: "#2F8AF2", label: "Moyen" },
    high: { fg: "#FFFFFF", bg: "#000000", label: "Élevé" },
    unknown: { fg: "#667085", bg: "#F2F4F7", label: "Inconnu" },
  },
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  brand: { fontSize: 28, fontWeight: "700" },
  title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 15, fontWeight: "400", color: colors.textSecondary, lineHeight: 22 },
  section: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: "400", color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: "400", color: colors.textSecondary },
};

/** Packages surveillés par le NotificationListener (Android). */
export const monitoredPackages = {
  WhatsApp: ["com.whatsapp", "com.whatsapp.w4b"],
  SMS: [
    "com.google.android.apps.messaging",
    "com.android.mms",
    "com.samsung.android.messaging",
  ],
  Email: ["com.google.android.gm", "com.microsoft.office.outlook"],
};

export const apiBaseUrl =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.API_BASE_URL) ||
  "http://10.0.2.2:8000/api/v1";

export const appVersion = "1.0.0";
