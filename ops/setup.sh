#!/usr/bin/env bash
# grower VPS セットアップ（さくらVPS Ubuntu 24.04 / 1GB＋swap2GB）。サイト非依存。
# sudo不要・ユーザ領域に導入（passwordless sudoを持たない前提）。
# 記事パイプライン（本文生成＋--light公開）専用。画像/スクショは手元で後追い。
#
# 使い方: setup.sh <repo-dir> <git-url>
#   例:    setup.sh ~/ppujp git@github-ppujp:minozo/ppujp.git
#   ※ ~/.ssh/config に サイト用の GitHub alias(IdentityFile=deploy key) を先に用意。
#   ※ 共有エンジン grower-core も兄弟dir に clone しておくこと:
#        git clone https://github.com/minozo/grower-core.git ~/grower-core
set -euo pipefail
REPO_DIR="${1:?repo-dir required (e.g. ~/ppujp)}"
GIT_URL="${2:?git-url required (e.g. git@github-ppujp:minozo/ppujp.git)}"
export NVM_DIR="$HOME/.nvm"

echo "▶ nvm + Node 20（sudo不要・ユーザ領域）"
[ -s "$NVM_DIR/nvm.sh" ] || curl -fsSL -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. "$NVM_DIR/nvm.sh"
nvm install 20 >/dev/null
nvm alias default 20 >/dev/null

echo "▶ Claude Code CLI（nvmのnpm global）"
npm install -g @anthropic-ai/claude-code >/dev/null

echo "▶ リポジトリ用意（$REPO_DIR）"
[ -d "$REPO_DIR/.git" ] || git clone "$GIT_URL" "$REPO_DIR"
cd "$REPO_DIR"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci   # 記事だけならブラウザ本体は不要

echo "node $(node -v) / claude $(claude --version 2>/dev/null || echo 要認証)"
NAME="$(basename "$REPO_DIR")"
cat <<NEXT

✅ setup 完了（$NAME）。残り（git管理外）:
  1) ~/grower.env（600）に DATAFORSEO_USERNAME/PASSWORD と CLAUDE_CODE_OAUTH_TOKEN
  2) 共有エンジン: git clone https://github.com/minozo/grower-core.git ~/grower-core
  3) スケジュール登録（sudo不要・user crontab・サイトごと別曜日）:
       bash ~/grower-core/ops/install-cron.sh $REPO_DIR "17 10 * * 1"
NEXT
