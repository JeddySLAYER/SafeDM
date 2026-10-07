# SafeDM brand kit

Logo = noir + bleu → **toujours fond blanc / transparent**, jamais sombre
(sinon la loupe noire disparaît).

| File | Role |
|------|------|
| `simplify-logo.png` / `icon-logo.png` | Sources mark (non carrées) |
| `icon-mark.png` | Mark 1024² transparent, safe zone (~66%) → launcher / adaptive |
| `icon-ui.png` | Mark 1024² plus serré → headers in-app |
| `full-logo.png` | Mark + wordmark |
| `text-logo.png` | Wordmark seul |

Generated Expo assets (`src/assets/`):

- `icon.png` — 1024² **fond blanc** (launcher)
- `adaptive-icon.png` — 1024² transparent + `backgroundColor: #FFFFFF`
- `splash.png` — full logo sur blanc

```bash
magick brand/simplify-logo.png -trim +repage -resize 720x720 \
  -background none -gravity center -extent 1024x1024 brand/icon-mark.png
magick brand/icon-mark.png -background '#FFFFFF' -alpha remove -alpha off icon.png
cp brand/icon-mark.png adaptive-icon.png
```
