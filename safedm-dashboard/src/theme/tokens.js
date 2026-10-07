export const colors = {
  blue50: "#EAF3FE",
  blue200: "#B8D7FA",
  bluePrimary: "#2F8AF2",
  blue600: "#1D6FD1",
  blue800: "#14549E",
  white: "#FFFFFF",
  section: "#F7F9FC",
  border: "#E4E7EC",
  textSecondary: "#667085",
  textPrimary: "#101828",
  risk: {
    low: { fg: "#12B76A", bg: "#ECFDF3" },
    medium: { fg: "#F79009", bg: "#FFFAEB" },
    high: { fg: "#F04438", bg: "#FEF3F2" },
    unknown: { fg: "#98A2B3", bg: "#F2F4F7" },
  },
};

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";
