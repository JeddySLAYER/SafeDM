# Design tokens SafeDM — source: charte couleur fournie
# À répliquer dans mobile (theme) et dashboard (CSS variables)

BRAND = {
    "blue_50": "#EAF3FE",
    "blue_200": "#B8D7FA",
    "blue_primary": "#2F8AF2",
    "blue_600": "#1D6FD1",
    "blue_800": "#14549E",
}

NEUTRALS = {
    "white": "#FFFFFF",
    "section": "#F7F9FC",
    "border": "#E4E7EC",
    "text_secondary": "#667085",
    "text_primary": "#101828",
}

RISK = {
    "low": {"fg": "#12B76A", "bg": "#ECFDF3"},
    "medium": {"fg": "#F79009", "bg": "#FFFAEB"},
    "high": {"fg": "#F04438", "bg": "#FEF3F2"},
    "unknown": {"fg": "#98A2B3", "bg": "#F2F4F7"},
}

# Package Android surveillés (seed Sprint 1)
MONITORED_APPS = [
    {"name": "WhatsApp", "package_name": "com.whatsapp"},
    {"name": "SMS", "package_name": "com.google.android.apps.messaging"},
    {"name": "Email", "package_name": "com.google.android.gm"},
]
