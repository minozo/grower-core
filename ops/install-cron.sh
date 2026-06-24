#!/usr/bin/env bash
# grower週次実行を user crontab に登録（sudo不要）。複数サイト共存対応。
# サイトごとに `# grower:<name>` タグで1行を管理（再登録は当該サイト行だけ置換）。
#
# 使い方: install-cron.sh <repo-dir> "<cron式>" [core-dir]
#   例:    install-cron.sh ~/ppujp "17 10 * * 1"        # 月曜10:17 JST
#          install-cron.sh ~/mvajp "27 10 * * 2"        # 火曜10:27（別曜日で共存）
set -euo pipefail
REPO_DIR="$(cd "${1:?repo-dir required (e.g. ~/ppujp)}" && pwd)"
CRON_EXPR="${2:?cron式 required (e.g. '17 10 * * 1')}"
HERE="$(cd "$(dirname "$0")" && pwd)"
CORE_DIR="${3:-$(cd "$HERE/.." && pwd)}"
NAME="$(basename "$REPO_DIR")"
RUN="$CORE_DIR/ops/run-grower.sh"
TAG="# grower:$NAME"
LINE="$CRON_EXPR REPO_DIR=$REPO_DIR GROWER_CORE_DIR=$CORE_DIR $RUN >> \$HOME/grower-cron-$NAME.log 2>&1 $TAG"

echo "system TZ: $(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo unknown)"
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$TAG" > "$tmp" || true
echo "$LINE" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"
echo "✅ crontab 登録 ($NAME):"
crontab -l | grep "$TAG"
echo "手動テスト: REPO_DIR=$REPO_DIR GROWER_CORE_DIR=$CORE_DIR bash $RUN ; tail -n 40 \$HOME/grower-$NAME-*.log"
