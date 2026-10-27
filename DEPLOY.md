# M-Pass 本番環境デプロイ手順

## 概要

本番環境（`https://tukumana.si.aoyama.ac.jp/members`、`/srv/m-pass`）へのデプロイは、**main ブランチへの push で自動的に行われます**。

```
main へ push
  → GitHub Actions（.github/workflows/deploy.yml）
      build:  npm ci → BASE_PATH=/members npm run build → .next を artifact としてアップロード
      deploy: POST https://tukumana.si.aoyama.ac.jp/members/api/deploy（Bearer DEPLOY_SECRET）
  → アプリ（/api/deploy）が deploy/deploy.sh をバックグラウンドで起動
      artifact を取得・検証 → git checkout <sha> → （必要なら）npm ci --omit=dev
      → .next を入れ替え → pm2 restart m-pass → ヘルスチェック（失敗したら元に戻す）
```

### この構成にしている理由

- **サーバーではビルドしない**: サーバーはメモリが 2GB しかなく、稼働中のアプリと並行して `next build`（型チェックを含む）を行うとメモリ不足でビルドが落ちるため、ビルドは GitHub Actions 上で行います。
- **アプリは専用ユーザー `webapps` で動かす**: PM2 はユーザーごとに別のデーモン（`~/.pm2`）を持つため、個人アカウント（例: ky）の PM2 で動かしていると、他の人はファイル権限でも PM2 でも操作できません。アプリのディレクトリと PM2 を専用ユーザー `webapps` にまとめ、担当者は `sudo -u webapps` で操作します。

## 通常のデプロイ

1. main に push（または PR をマージ）する
2. GitHub の **Actions** タブで「Build and Deploy」が成功したことを確認する
3. 必要に応じてサーバーでログを確認する

```bash
tail -f /srv/m-pass/logs/deploy.log
sudo -u webapps -H pm2 status
```

ビルドだけ行いたい場合は、Actions の「Build and Deploy」から **Run workflow** を実行し、`deploy` のチェックを外します。

## 手動デプロイ・ロールバック

指定したコミットのビルド成果物（Actions の artifact、保存期間 30 日）を配置します。ロールバックする場合は、戻したいコミットの SHA を指定します。

```bash
sudo -u webapps -H /srv/m-pass/deploy/deploy.sh <commit-sha(40桁)>
```

## サーバー上での操作

PM2 は `webapps` ユーザーのものを操作する必要があります（自分のユーザーで `pm2` を実行しても別の PM2 が表示されるだけです）。

```bash
sudo -u webapps -H pm2 status
sudo -u webapps -H pm2 logs m-pass --lines 50
sudo -u webapps -H pm2 restart m-pass
```

### やってはいけないこと

- **サーバー上で `npm run build` を実行しない**（メモリ不足で落ち、`.next` が壊れた状態で残ることがあります）
- **`sudo npm ...` や `sudo git ...` を使わない**（ファイルの所有者が root になり、`webapps` からも操作できなくなります）。操作は必ず `sudo -u webapps -H ...` で行います
- `/srv/m-pass` で `git pull` しない（`deploy.sh` が特定のコミットを checkout した状態で運用します）

## 初回セットアップ

### 1. GitHub の設定

リポジトリの **Settings → Secrets and variables → Actions** で、Secret `DEPLOY_SECRET` を登録します。

```bash
# 値の生成例
openssl rand -hex 32
```

### 2. artifact 取得用トークンの作成

GitHub で fine-grained personal access token を作成します。

- Repository access: `tukumanalab/m-pass` のみ
- Permissions: **Actions: Read-only**（それ以外は不要）

トークンには有効期限があるため、期限切れ前に更新してください（期限切れになると `deploy.log` に artifact の取得エラーが出ます）。

### 3. 専用ユーザー `webapps` への移行（管理者が一度だけ実施）

数十秒程度アプリが停止します。

```bash
# 3-1. 専用ユーザーとデプロイ担当者グループを作成
sudo useradd --system --create-home --home-dir /var/lib/webapps --shell /usr/sbin/nologin webapps
sudo groupadd webapps-deploy
sudo usermod -aG webapps-deploy <担当者のユーザー名>

# 3-2. Node.js 22 と PM2 をシステム全体（/usr/bin）にインストール
#      （個人の nvm に入っている Node は webapps から使えないため）
#      Node を更新すると同じサーバーの他のアプリも新しい Node で動くことに注意する。
#      既存ユーザーの PM2 デーモンは pm2 update で新しい Node に切り替える
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
pm2 update
sudo -u webapps -H node -v
sudo -u webapps -H pm2 -v

# 3-3. 今まで動かしていたユーザー（例: ky）の PM2 から m-pass を外す（ky で実行）
#      ky の PM2 で他のアプリも動いている場合があるため、pm2-ky 自体は止めない
pm2 delete m-pass
pm2 save

# 3-4. ディレクトリの所有者を変更し、.env に自動デプロイ用の値を追加
sudo chown -R webapps:webapps /srv/m-pass
sudo -u webapps -H nano /srv/m-pass/.env   # DEPLOY_SECRET と GITHUB_ARTIFACT_TOKEN を追加
sudo chmod 600 /srv/m-pass/.env

# 3-5. 初回だけ手動でデプロイ（webapps の PM2 で起動される）
#      サーバーにはまだ deploy.sh と /api/deploy が無いため、最初の 1 回は手で行う。
#      この仕組みを含むコミットを main に push し、Actions の build が成功してから実行する
#      （このときの deploy ジョブは /api/deploy がまだ無いため失敗するが問題ない）
cd /srv/m-pass
#      origin が git@github.com:...（個人の SSH 鍵）だと webapps から fetch できないため HTTPS にする（public リポジトリ）
sudo -u webapps -H git remote set-url origin https://github.com/tukumanalab/m-pass.git
sudo -u webapps -H git fetch origin
sudo -u webapps -H git checkout --detach origin/main
sudo -u webapps -H ./deploy/deploy.sh "$(sudo -u webapps -H git rev-parse origin/main)"

# 3-6. 自動起動を設定
sudo env PATH=$PATH pm2 startup systemd -u webapps --hp /var/lib/webapps
systemctl status pm2-webapps
```

`.env` に追加する値（詳細は [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md)）:

```env
DEPLOY_SECRET=<GitHub の Secret と同じ値>
GITHUB_ARTIFACT_TOKEN=<手順 2 で作成したトークン>
```

移行後、サーバーを再起動してもアプリが起動することを確認してください。

元に戻す場合は、`sudo chown -R ky:ky /srv/m-pass` のあと ky の PM2 で起動し直し、`pm2-webapps` を無効化します。

### 4. sudo の設定（担当者がパスワードなしで操作できるようにする場合）

```bash
sudo visudo -f /etc/sudoers.d/webapps
```

```
%webapps-deploy ALL=(webapps) NOPASSWD: /srv/m-pass/deploy/deploy.sh, /usr/bin/pm2
```

`pm2` のパスは `which pm2` で確認してください。

### 5. Nginx 設定

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/m-pass
sudo ln -sf /etc/nginx/sites-available/m-pass /etc/nginx/sites-enabled/m-pass
sudo nginx -t
sudo systemctl restart nginx
```

## トラブルシューティング

### 自動デプロイが動かない

1. GitHub Actions の deploy ジョブのログを確認する
   - `401`: GitHub の Secret `DEPLOY_SECRET` とサーバーの `.env` の値が一致していない
   - `503`: サーバーの `.env` に `DEPLOY_SECRET` が設定されていない（設定後に `pm2 restart` が必要）
2. サーバーの `/srv/m-pass/logs/deploy.log` を確認する
   - 「ビルド成果物が見つかりません」: `GITHUB_ARTIFACT_TOKEN` の期限切れ・権限不足、または artifact の保存期間切れ
   - 「ヘルスチェックに失敗しました」: 自動で前のバージョンに戻っています。`sudo -u webapps -H pm2 logs m-pass` と `.next.failed` を確認する

### サーバー再起動後にアプリが起動しない

```bash
systemctl status pm2-webapps
sudo -u webapps -H pm2 list

# 再設定
cd /srv/m-pass
sudo -u webapps -H pm2 start deploy/pm2.config.js
sudo -u webapps -H pm2 save
sudo systemctl restart pm2-webapps
```

### 画像や CSS が読み込めない

1. **BASE_PATH 環境変数の確認**

   ```bash
   sudo -u webapps -H pm2 show m-pass | grep BASE_PATH
   ```

   → `BASE_PATH: /members` が表示されることを確認（ビルドは Actions 上で `BASE_PATH=/members` で行われます）

2. **Nginx のエラーログを確認**
   ```bash
   sudo tail -f /var/log/nginx/m-pass_error.log
   ```

### アップロードファイルが表示されない・保存できない

```bash
ls -la /srv/m-pass/public/uploads/
sudo -u www-data ls /srv/m-pass/public/uploads/
```

所有者が `webapps` 以外になっている場合は `sudo chown -R webapps:webapps /srv/m-pass` で戻してください。

## 確認項目チェックリスト

- [ ] `https://tukumana.si.aoyama.ac.jp/members` でページが表示される
- [ ] ロゴ画像が正しく表示される
- [ ] CSS が正しく適用されている
- [ ] ナビゲーションリンクが `/members/...` で動作する
- [ ] アップロードした画像が表示される・新しくアップロードできる
- [ ] QR コード生成が動作する
- [ ] ログイン/ログアウトが動作する

## 重要な注意事項

1. **`BASE_PATH`** はビルド時（Actions の build ジョブ）とランタイム（`deploy/pm2.config.js`）の両方で `/members` を指定しています。変更する場合は両方を揃えてください
2. **Nginx の proxy_pass** は末尾の `/` に注意（`http://localhost:3000` であり `http://localhost:3000/` ではない）
3. **Node.js のバージョン** は `.nvmrc`（Actions のビルドで使用）とサーバーのメジャーバージョンを揃えてください（`better-sqlite3` / `bcrypt` などのネイティブモジュールはサーバー上の `npm ci` でインストールされます）
