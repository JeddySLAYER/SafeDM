/**
 * Design tokens — SafeDM mobile (not API config).
 * Prefer surface backgrounds + section lists over bordered web cards.
 */

export const colors = {
  blue50: "#EAF3FE",
  blueSoft: "#F0F7FF",
  blue200: "#B8D7FA",
  bluePrimary: "#2F8AF2",
  blue600: "#1D6FD1",
  blue800: "#14549E",
  white: "#FFFFFF",
  black: "#000000",
  canvas: "#F2F4F7",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF2F6",
  border: "#E4E7EC",
  borderSubtle: "#F2F4F7",
  textSecondary: "#667085",
  textMuted: "#98A2B3",
  textPrimary: "#101828",
  danger: "#F04438",
  success: "#12B76A",
  risk: {
    low: { fg: "#FFFFFF", bg: "#12B76A", label: "Faible" },
    medium: { fg: "#FFFFFF", bg: "#2F8AF2", label: "Moyen" },
    high: { fg: "#FFFFFF", bg: "#101828", label: "Élevé" },
    unknown: { fg: "#667085", bg: "#F2F4F7", label: "Inconnu" },
  },
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const typography = {
  brand: { fontSize: 26, fontWeight: "700", letterSpacing: -0.3 },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  body: { fontSize: 15, fontWeight: "400", color: colors.textPrimary, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: "400", color: colors.textSecondary, lineHeight: 18 },
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
