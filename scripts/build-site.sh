#!/usr/bin/env bash
# Assembles the deployable site into _site/: the app only, skipping dev tools
# that talk to Supabase directly (seed/migrate/load-test/clear), docs, and SQL.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site && mkdir _site
cp -r js styles fonts brand-assets styles.css _site/
rm -f _site/js/data-service.js
for f in *.html; do
    case "$f" in
        seed-data.html|migrate-data.html|load-test.html|clear-data.html|button-style-guide.html) ;;
        *) cp "$f" _site/ ;;
    esac
done
