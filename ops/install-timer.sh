#!/usr/bin/env bash
# systemd timer 登録（sudo可能なVPSユーザ向け・cron版の代替）。複数サイト共存対応。
# ユニット名を grower-<name> にしてサイトごとに別ユニット化。
#
# 使い方: install-timer.sh <name> <repo-dir> "<OnCalendar>" [core-dir]
#   例:    install-timer.sh ppujp ~/ppujp "Mon *-*-* 10:17:00"
#          install-timer.sh mvajp ~/mvajp "Tue *-*-* 10:27:00"
set -euo pipefail
NAME="${1:?name required (e.g. ppujp)}"
REPO_DIR="$(cd "${2:?repo-dir required}" && pwd)"
ONCAL="${3:?OnCalendar required (e.g. 'Mon *-*-* 10:17:00')}"
HERE="$(cd "$(dirname "$0")" && pwd)"
CORE_DIR="${4:-$(cd "$HERE/.." && pwd)}"
USER_NAME="$(id -un)"
UNIT="grower-$NAME"

render() {
  sed -e "s|__NAME__|$NAME|g" \
      -e "s|__USER__|$USER_NAME|g" \
      -e "s|__REPO_DIR__|$REPO_DIR|g" \
      -e "s|__CORE_DIR__|$CORE_DIR|g" \
      -e "s|__ONCALENDAR__|$ONCAL|g" "$1"
}

render "$HERE/templates/grower.service.tmpl" | sudo tee "/etc/systemd/system/$UNIT.service" >/dev/null
render "$HERE/templates/grower.timer.tmpl"   | sudo tee "/etc/systemd/system/$UNIT.timer"   >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now "$UNIT.timer"
echo "✅ 登録完了: $UNIT.timer"
systemctl list-timers --all | grep "$UNIT" || true
echo "手動テスト: sudo systemctl start $UNIT.service && journalctl -u $UNIT.service -n 30 --no-pager"
