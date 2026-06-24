#!/usr/bin/env bash
# 汎用 grower 週次ランナー（サイト非依存）。systemd/cron から呼ばれる。
# 本文生成→ゲート→--light公開(buildはCloudflare)→計測。画像は手元で後追い。
# 認証/APIキーは ~/grower.env（git管理外・600）から読む。
#
# 使い方:  REPO_DIR=~/ppujp run-grower.sh    または    run-grower.sh ~/ppujp
#   作業ブランチは対象サイトの grower.config.json の publishBranches[0]（無ければ dev）。
set -uo pipefail

REPO_DIR="${1:-${REPO_DIR:-$HOME/ppujp}}"
cd "$REPO_DIR" || { echo "no repo: $REPO_DIR"; exit 1; }

# nvm（ユーザ領域のNode/claude）をcron/非ログイン環境でもPATHに載せる
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
[ -f "$HOME/grower.env" ] && { set -a; . "$HOME/grower.env"; set +a; }
export GROWER_PUBLISH_LIGHT=1   # 1GB対応: npm run build を回さず astro check で検証
export GROWER_CORE_DIR="${GROWER_CORE_DIR:-$HOME/grower-core}"  # 共有エンジン（兄弟dir）

# サイト固有値は grower.config.json から読む（branch=publishBranches[0] / サイト名=ログ表示）
read_cfg() { node -e "try{const c=require('$REPO_DIR/grower.config.json');process.stdout.write(String($1))}catch(e){process.stdout.write('')}" 2>/dev/null; }
BRANCH="$(read_cfg "(c.publishBranches&&c.publishBranches[0])||'dev'")"; BRANCH="${BRANCH:-dev}"
SITE="$(read_cfg "c.siteName||''")"
NAME="$(basename "$REPO_DIR")"

# 共有エンジンを最新化（grower-coreはpublic repo）
[ -d "$GROWER_CORE_DIR/.git" ] && git -C "$GROWER_CORE_DIR" pull -q --ff-only 2>/dev/null || true
# サイトをリモートに同期してから作業（自動runnerの安全策）
git fetch origin "$BRANCH" -q && git switch "$BRANCH" -q && git reset --hard "origin/$BRANCH" -q

LOG="$HOME/grower-$NAME-$(date +%Y%m%d-%H%M).log"
{
  echo "=== grower weekly ${SITE:-$NAME} ($(date)) ==="
  npm run grow weekly      # measure + 自動補充(scout) + work order
  echo "=== autorun (記事1本: 生成→gates→--light publish) ==="
  npm run grow autorun     # publishは GROWER_PUBLISH_LIGHT=1 で軽量
} >>"$LOG" 2>&1
echo "done → $LOG"
# 直近30日より古いログを掃除
find "$HOME" -maxdepth 1 -name 'grower-*.log' -mtime +30 -delete 2>/dev/null || true
