# Sécurité — SafeDM (Sprint 9)

## Règles produit

- Contenu des messages **non stocké** à l’analyse (uniquement après signalement explicite)
- Clés Gemini / VirusTotal **uniquement** dans le backend `.env`
- API indisponible → `UNKNOWN` / `PARTIAL`, **jamais** `SAFE` par défaut
- NotificationListener : lecture seule, **ne bloque ni ne modifie** les messages
- Logs d’analyse : longueur / statut / score uniquement — **pas le contenu**

## Hardening checklist

| Item | Dev | Prod |
|------|-----|------|
| `SECRET_KEY` unique | à changer | obligatoire |
| `ANALYSIS_DEMO_MODE` | `true` OK | `false` |
| CORS restreint | localhost | domaines admin seulement |
| HTTPS | HTTP local OK | reverse proxy (Caddy/Nginx) |
| Cleartext Android | `network_security_config` | HTTPS only |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | + HSTS si `APP_ENV=production` |
| Backup DB | local | chiffré / accès limité |

## Headers API

Le middleware `SecurityHeadersMiddleware` ajoute :

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security` si `APP_ENV=production`

## HTTPS (prod)

Exemple Nginx devant uvicorn :

```nginx
server {
  listen 443 ssl;
  server_name api.safedm.example;
  # ssl_certificate ...
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

Fronts : pointer `VITE_API_BASE_URL` / `API_BASE_URL` vers `https://api.safedm.example/api/v1`.
