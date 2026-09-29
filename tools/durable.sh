#!/usr/bin/env bash
# Durability helpers for the Notion Toggle plugin source that lives in /dev-server/plugin.
# The project folder survives sandbox resets and workspace moves; /tmp does not.
#
#   bash plugin/tools/durable.sh setup          # after a reset: bun install + /tmp/full link + git metadata
#   bash plugin/tools/durable.sh snapshot LABEL # dated source zip into Files (/mnt/documents/backups)
#   bash plugin/tools/durable.sh git ARGS...    # read-only git against the plugin repo (status, diff, log)
set -euo pipefail
PLUGIN=/dev-server/plugin
GITDIR=/tmp/plugin.git
REPO=https://github.com/RR-LIBRARY/obsidian-notion-toggle

ensure_git() {
  if [ ! -d "$GITDIR" ]; then
    git clone --quiet --bare "$REPO" "$GITDIR"
    git --git-dir="$GITDIR" config core.bare false
    # A bare clone has no populated index. Load HEAD explicitly so status
    # compares the durable work tree instead of reporting every repo file deleted.
    git --git-dir="$GITDIR" --work-tree="$PLUGIN" read-tree HEAD
  fi
}

case "${1:-}" in
  setup)
    [ -L /tmp/full ] || { rm -rf /tmp/full; ln -s "$PLUGIN" /tmp/full; }
    (cd "$PLUGIN" && bun install --frozen-lockfile >/dev/null 2>&1)
    ensure_git
    echo "plugin ready at $PLUGIN (linked as /tmp/full)"
    ;;
  snapshot)
    mkdir -p /mnt/documents/backups
    out="/mnt/documents/backups/plugin-src-$(date +%Y%m%d-%H%M)-${2:-wip}.zip"
    (cd /dev-server && zip -qr "$out" plugin -x 'plugin/node_modules/*' 'plugin/e2e/out/*')
    ls -t /mnt/documents/backups/*.zip | head -3
    ;;
  git)
    shift; ensure_git
    git --git-dir="$GITDIR" --work-tree="$PLUGIN" "$@"
    ;;
  *)
    sed -n 2,8p "$0"; exit 1 ;;
esac
