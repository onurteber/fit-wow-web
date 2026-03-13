# FitWow website

Static site for FitWow (privacy policy, terms, etc.).

## Multi-language structure

- **Root:** `privacy.html` redirects to `en/privacy.html`.
- **Per language:** `en/`, `tr/`, `de/`, `es/`, `fr/`, `zh/`, `pt/`, `ar/`, `it/`, `ru/` each contain `privacy.html`.
- **App:** Opens `https://www.fitwowapp.com/{locale}/privacy.html` using the user’s current app language.

If the site is deployed under a subpath (e.g. `/website/`), the app should use that base (e.g. `https://www.fitwowapp.com/website/{locale}/privacy.html`).

## Adding or updating translations

1. Copy `en/privacy.html` to `{lang}/privacy.html`.
2. Set `<html lang="{lang}">` (and `dir="rtl"` for Arabic).
3. Translate title, meta description, and body content. Keep the same structure and CSS classes.
