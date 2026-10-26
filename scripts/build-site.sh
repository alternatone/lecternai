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
    sed -i -E 's/Aquinas (Primary|Secondary) Colors/\1 Colors/; s#\s*/\* [A-Za-z ]*PMS [0-9]+ \*/##' _site/styles.css _site/styles/*.css
    # Brand fonts (licensed) -> system fonts
    rm -rf _site/fonts
    perl -0pi -e 's#/\*[^*]*(Benton|Garamond)[^*]*\*/\n?##g; s#\@font-face\s*\{[^}]*\}\s*##g' _site/styles.css _site/styles/*.css
    sed -i -E "s/'Benton Sans'/system-ui/g; s/'Adobe Garamond Pro', //g" _site/*.html _site/styles.css _site/styles/*.css _site/js/*.js
    # Brand palette -> neutral palette
    sed -i -E \
        -e 's/#a21f35/#2c4a6e/gi; s/162, ?31, ?53/44, 74, 110/g' \
        -e 's/#7f1f1f/#1e3450/gi' \
        -e 's/#ffc222/#d8a446/gi; s/255, ?194, ?34/216, 164, 70/g' \
        -e 's/#a2a569/#8c9a86/gi' \
        -e 's/#106470/#6b5b95/gi; s/16, ?100, ?112/107, 91, 149/g' \
        -e 's/#8a8b8c/#8a8d91/gi' \
        _site/*.html _site/styles.css _site/styles/*.css _site/js/*.js
    if grep -rqiE "aquinas institute|aquinas-(logo|seal)|Institute of Theology|benton|adobe garamond|PMS [0-9]|#(a21f35|7f1f1f|ffc222|a2a569|106470)|162, ?31, ?53|255, ?194, ?34|16, ?100, ?112" _site; then
        echo "error: institution branding left in demo build" >&2
        exit 1
    fi
fi
