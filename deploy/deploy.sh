#!/bin/bash

# M-Pass デプロイスクリプト
# GitHub Actions でビルドした成果物（.next）を取得して入れ替え、PM2 で再起動する
# サーバー上では next build を実行しない（メモリ不足対策）
#
# 使い方:
#   deploy/deploy.sh <commit-sha> [run-id]
#
# /api/deploy（GitHub Actions からの Webhook）から自動で呼ばれる。
# 手動でデプロイ・ロールバックする場合は、アプリの実行ユーザーとして実行する:
#   sudo -u webapps -H /srv/m-pass/deploy/deploy.sh <commit-sha>

set -euo pipefail

REPO="tukumanalab/m-pass"
APP_NAME="m-pass"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3000/members}"
GITHUB_API="${GITHUB_API_URL:-https://api.github.com}"

log_info() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >&2
}

# GitHub API を呼び出す
github_api() {
  curl -fsSL \
    -H "Authorization: Bearer $GITHUB_ARTIFACT_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

# .env から値を読み込む（環境変数で指定されていればそちらを優先）
read_env_value() {
  local key="$1"
  if [ -n "${!key:-}" ]; then
    echo "${!key}"
    return
  fi
  if [ -f "$APP_DIR/.env" ]; then
    grep -E "^${key}=" "$APP_DIR/.env" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
  fi
}

restart_app() {
  if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    pm2 restart "$APP_NAME"
  else
    pm2 start "$APP_DIR/deploy/pm2.config.js"
  fi
  pm2 save
}

health_check() {
  local i
  for i in $(seq 1 15); do
    if curl -fsS -o /dev/null "$HEALTH_CHECK_URL"; then
      return 0
    fi
    log_info "ヘルスチェック待機中... ($i/15)"
    sleep 2
  done
  return 1
}

# package-lock.json が変わったとき、または Node のバージョンが変わったとき
# （better-sqlite3 などのネイティブモジュールは Node のバージョンごとにビルドが必要）に npm ci する
install_dependencies_if_changed() {
  local from="$1"
  local to="$2"
  local marker="$APP_DIR/node_modules/.installed-node-version"
  if [ -z "$from" ] || [ ! -d "$APP_DIR/node_modules" ] \
    || [ "$(cat "$marker" 2>/dev/null)" != "$(node -v)" ] \
    || ! git diff --quiet "$from" "$to" -- package-lock.json; then
    log_info "依存関係をインストールしています (npm ci --omit=dev)..."
    npm ci --omit=dev --no-audit --no-fund
    node -v > "$marker"
  else
    log_info "package-lock.json と Node のバージョンに変更がないため npm ci をスキップします"
  fi
}

main() {
  local sha="${1:-}"
  local run_id="${2:-}"

  if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "使い方: $0 <commit-sha(40桁)> [run-id]" >&2
    exit 1
  fi

  cd "$APP_DIR"

  # アプリのディレクトリの所有者（= PM2 を動かしているユーザー）で実行されているか確認
  local owner
  owner="$(stat -c %U "$APP_DIR")"
  if [ "$(id -un)" != "$owner" ]; then
    log_error "このスクリプトは $owner ユーザーで実行してください"
    echo "  sudo -u $owner -H $0 $*" >&2
    exit 1
  fi

  # 同時に複数のデプロイが動かないようにロックを取る
  exec 9> "$APP_DIR/.deploy.lock"
  if ! flock -n 9; then
    log_info "他のデプロイが実行中のため、終了を待っています..."
    flock 9
  fi

  log_info "========================================="
  log_info "デプロイを開始します: $sha ${run_id:+(run $run_id)}"
  log_info "========================================="

  GITHUB_ARTIFACT_TOKEN="$(read_env_value GITHUB_ARTIFACT_TOKEN)"
  if [ -z "$GITHUB_ARTIFACT_TOKEN" ]; then
    log_error "GITHUB_ARTIFACT_TOKEN が設定されていません (.env を確認してください)"
    exit 1
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d "$APP_DIR/.deploy-tmp.XXXXXX")"
  # local 変数は終了時には参照できないため、trap 設定時に展開しておく
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp_dir'" EXIT

  # 1. ビルド成果物（GitHub Actions の artifact）を取得
  log_info "1. ビルド成果物を取得しています..."
  local artifact_id
  artifact_id="$(github_api "$GITHUB_API/repos/$REPO/actions/artifacts?name=m-pass-build-$sha" \
    | node -e '
      let s = "";
      process.stdin.on("data", (d) => (s += d)).on("end", () => {
        const runId = process.argv[1];
        const artifacts = JSON.parse(s).artifacts.filter((a) => !a.expired);
        const artifact = artifacts.find((a) => String(a.workflow_run?.id) === runId) || artifacts[0];
        if (artifact) console.log(artifact.id);
      });
    ' "$run_id")"
  if [ -z "$artifact_id" ]; then
    log_error "コミット $sha のビルド成果物が見つかりません（ビルド未完了か、保存期間切れの可能性があります）"
    exit 1
  fi

  github_api -o "$tmp_dir/artifact.zip" "$GITHUB_API/repos/$REPO/actions/artifacts/$artifact_id/zip"
  python3 -m zipfile -e "$tmp_dir/artifact.zip" "$tmp_dir/"
  (cd "$tmp_dir" && sha256sum -c m-pass-build.tar.gz.sha256)

  mkdir -p "$tmp_dir/extract"
  tar -xzf "$tmp_dir/m-pass-build.tar.gz" -C "$tmp_dir/extract"
  if [ "$(cat "$tmp_dir/extract/.next/BUILD_COMMIT" 2>/dev/null)" != "$sha" ]; then
    log_error "成果物のコミット (BUILD_COMMIT) が $sha と一致しません"
    exit 1
  fi

  # 2. ソースコードを対象のコミットに切り替え
  log_info "2. ソースコードを $sha に切り替えています..."
  local prev_commit deployed_commit
  prev_commit="$(git rev-parse HEAD)"
  deployed_commit="$(cat "$APP_DIR/.deployed-commit" 2>/dev/null || echo "$prev_commit")"
  git fetch --quiet origin
  git checkout --quiet --detach "$sha"

  # 3. 依存関係（package-lock.json が変わったときのみ）
  log_info "3. 依存関係を確認しています..."
  install_dependencies_if_changed "$deployed_commit" "$sha"

  # 4. .next を入れ替えて再起動
  log_info "4. ビルド成果物を入れ替えて再起動しています..."
  rm -rf "$APP_DIR/.next.prev"
  if [ -d "$APP_DIR/.next" ]; then
    mv "$APP_DIR/.next" "$APP_DIR/.next.prev"
  fi
  mv "$tmp_dir/extract/.next" "$APP_DIR/.next"
  restart_app

  # 5. ヘルスチェック（失敗したら元に戻す）
  log_info "5. ヘルスチェック中 ($HEALTH_CHECK_URL)..."
  if ! health_check; then
    log_error "ヘルスチェックに失敗しました。前のバージョン ($prev_commit) に戻します"
    rm -rf "$APP_DIR/.next.failed"
    mv "$APP_DIR/.next" "$APP_DIR/.next.failed"
    if [ -d "$APP_DIR/.next.prev" ]; then
      mv "$APP_DIR/.next.prev" "$APP_DIR/.next"
    fi
    git checkout --quiet --detach "$prev_commit"
    install_dependencies_if_changed "$sha" "$prev_commit"
    restart_app
    log_error "ロールバックしました。原因は pm2 logs $APP_NAME と .next.failed を確認してください"
    exit 1
  fi

  echo "$sha" > "$APP_DIR/.deployed-commit"

  log_info "========================================="
  log_info "デプロイが完了しました: $sha"
  log_info "========================================="
}

# 実行中に git checkout でこのファイル自体が書き換わっても影響しないよう、
# 関数として全体を読み込んでから実行する
main "$@"
exit
