# Publicar en npm

`.github/workflows/release.yml` publica en npm con provenance al publicar un release de GitHub (tag
`vX.Y.Z`). También se puede lanzar a mano: Actions → **Release** → **Run workflow**.

## La primera vez (0.1.0)

npm no tiene *pending publisher*: el trusted publisher solo se configura sobre un paquete que ya existe.

1. Crea en npmjs.com un token granular de lectura y escritura (vence en 7 días; con "Bypass 2FA" si tu
   cuenta pide 2FA para publicar) y guárdalo en el environment `npm`:
   `gh secret set NPM_TOKEN --env npm --repo typesearch-ai/typesearch-js`.
2. Publica el release `v0.1.0`.
3. En npmjs.com/package/typesearch-js → Settings → **Trusted Publisher** → GitHub Actions: owner
   `typesearch-ai`, repository `typesearch-js`, workflow `release.yml`, environment `npm`. En
   *Publishing access*, elige "Require two-factor authentication and disallow tokens".
4. Borra el token en npm y el secreto:
   `gh secret delete NPM_TOKEN --env npm --repo typesearch-ai/typesearch-js`.

Desde ahí se publica con OIDC, sin tokens.

## Publicar una versión

1. Sube `version` en `package.json` (y `package-lock.json`: `npm version X.Y.Z --no-git-tag-version`).
2. En `CHANGELOG.md`, cambia `## [X.Y.Z] - Unreleased` por la fecha (`YYYY-MM-DD`) y agrega el enlace
   `[X.Y.Z]: …/releases/tag/vX.Y.Z` al pie.
3. PR contra `main`, CI en verde, merge.
4. Crea y publica en GitHub el release `vX.Y.Z` sobre `main`. El workflow verifica que el tag coincida con
   `package.json` (si no, falla antes de publicar), corre lint, tests, build y smoke, y publica.
