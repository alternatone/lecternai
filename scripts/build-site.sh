#!/usr/bin/env bash
# Assembles the deployable site into _site/: the app only, skipping dev tools
# that talk to Supabase directly (seed/migrate/load-test/clear), docs, and SQL.
#
#   scripts/build-site.sh          production build
#   scripts/build-site.sh --demo   public demo: sample data, no Supabase,
#                                  no institution branding, one-click logins
set -euo pipefail
cd "$(dirname "$0")/.."
DEMO=false
[[ "${1:-}" == "--demo" ]] && DEMO=true

rm -rf _site && mkdir _site
cp -r js styles fonts brand-assets styles.css _site/
rm -f _site/js/data-service.js
for f in *.html; do
    case "$f" in
        seed-data.html|migrate-data.html|load-test.html|clear-data.html|button-style-guide.html) ;;
        *) cp "$f" _site/ ;;
    esac
done

if $DEMO; then
    echo "export const DEMO_BUILD = true" > _site/js/demo-flag.js
    # Account pages have no meaning without real auth
    rm -f _site/signup.html _site/forgot-password.html _site/reset-password.html
    # Strip institution branding
    rm -rf _site/brand-assets
    sed -i -E \
        -e '/brand-assets\/aquinas-(logo|seal)\.svg/d' \
        -e 's/Lectern - Aquinas Institute of Theology/Lectern/' \
        -e 's#<p>Aquinas Institute of Theology</p>#<p>Seminary learning platform</p>#' \
        _site/*.html
    sed -i -E 's/Aquinas (Primary|Secondary) Colors/\1 Colors/' _site/styles.css _site/styles/*.css
    if grep -rqiE "aquinas institute|aquinas-(logo|seal)|Institute of Theology" _site; then
        echo "error: institution branding left in demo build" >&2
        exit 1
    fi
fi
