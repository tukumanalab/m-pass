# M-Pass 本番環境デプロイ手順

## 問題の解決内容

`/members` というベース URL でデプロイした際に画像やリンクが正しく動作しない問題を修正しました。

### 修正内容

1. **PM2 設定** (`deploy/pm2.config.js`)

   - `BASE_PATH=/members` 環境変数を追加
   - デプロイパスを `/srv/m-pass` に設定

2. **Nginx 設定** (`deploy/nginx.conf`)

   - プロキシパスを `/members` → `http://localhost:3000` に修正（末尾の `/` を削除）
   - アップロードファイルのパスを `/srv/m-pass/public/uploads/` に修正
   - 重複する `location /members/` ブロックを削除

3. **セットアップスクリプト** (`deploy/setup.sh`)
   - PM2 設定ファイルを使用するように変更

## 本番環境でのデプロイ手順

### 1. サーバーにログイン

```bash
ssh your-server
```

### 2. コードを更新

```bash
cd /srv/m-pass
git pull origin main
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. ビルド（BASE_PATH を設定）

```bash
BASE_PATH=/members npm run build
```

> **Note**: ビルドスクリプトには `NODE_OPTIONS='--max-old-space-size=4096'` が設定されており、メモリ不足エラーを防ぎます。

### 5. PM2 でアプリケーションを再起動

```bash
# 既存のプロセスを停止
pm2 delete m-pass 2>/dev/null || true

# 新しい設定で起動
pm2 start deploy/pm2.config.js

# PM2の設定を保存
pm2 save
```

### 5.1. PM2 自動起動の設定（初回のみ）

サーバー再起動時にm-passが自動起動するように設定します：

```bash
# PM2のスタートアップスクリプトを生成
pm2 startup

# 表示されたsudoコマンドをコピーして実行
# 例: sudo env PATH=$PATH:/home/ky/.nvm/versions/node/v22.21.0/bin /home/ky/.nvm/versions/node/v22.21.0/lib/node_modules/pm2/bin/pm2 startup systemd -u ky --hp /home/ky

# 現在のプロセスリストを保存（これがリブート時に復元される）
pm2 save

# 設定確認
systemctl status pm2-ky
```

> **重要**: `pm2 save`を実行しないと、リブート後にアプリケーションが起動しません。アプリケーションの設定を変更した場合は、必ず`pm2 save`を再実行してください。

### 6. Nginx 設定を更新

```bash
# Nginx設定をコピー
sudo cp deploy/nginx.conf /etc/nginx/sites-available/m-pass

# シンボリックリンクを作成（既に存在する場合は不要）
sudo ln -sf /etc/nginx/sites-available/m-pass /etc/nginx/sites-enabled/m-pass

# Nginx設定をテスト
sudo nginx -t

# Nginxを再起動
sudo systemctl restart nginx
```

### 7. 動作確認

```bash
# PM2のステータス確認
pm2 status

# ログ確認
pm2 logs m-pass --lines 50

# アプリケーションにアクセス
# https://tukumana.si.aoyama.ac.jp/members
```

## トラブルシューティング

### サーバー再起動後にアプリケーションが起動しない場合

1. **PM2サービスのステータスを確認**

   ```bash
   systemctl status pm2-ky
   ```

2. **PM2プロセスリストを確認**

   ```bash
   pm2 list
   ```

3. **PM2のスタートアップ設定を確認**

   ```bash
   # スタートアップが設定されているか確認
   systemctl list-unit-files | grep pm2
   ```

4. **再設定が必要な場合**

   ```bash
   # アプリケーションを起動
   cd /srv/m-pass
   pm2 start deploy/pm2.config.js
   
   # プロセスリストを保存
   pm2 save
   
   # systemdサービスを再起動
   sudo systemctl restart pm2-ky
   ```

### 画像や CSS が読み込めない場合

1. **BASE_PATH 環境変数の確認**

   ```bash
   pm2 show m-pass | grep BASE_PATH
   ```

   → `BASE_PATH: /members` が表示されることを確認

2. **Next.js のビルドログを確認**

   ```bash
   pm2 logs m-pass --lines 100
   ```

3. **Nginx のエラーログを確認**
   ```bash
   sudo tail -f /var/log/nginx/m-pass_error.log
   ```

### アップロードファイルが表示されない場合

1. **ディレクトリのパーミッション確認**

   ```bash
   ls -la /srv/m-pass/public/uploads/
   ```

2. **Nginx がファイルにアクセスできるか確認**
   ```bash
   sudo -u www-data ls /srv/m-pass/public/uploads/
   ```

### 既存のデプロイから移行する場合

もし既に別の設定でデプロイされている場合：

```bash
# 1. 現在のアプリケーションを停止
pm2 delete m-pass

# 2. ビルドキャッシュをクリア
rm -rf /srv/m-pass/.next

# 3. BASE_PATHを指定して再ビルド
cd /srv/m-pass
BASE_PATH=/members npm run build

# 4. 新しい設定で起動
pm2 start deploy/pm2.config.js
pm2 save

# 5. Nginx設定を更新して再起動
sudo cp deploy/nginx.conf /etc/nginx/sites-available/m-pass
sudo nginx -t
sudo systemctl restart nginx
```

## 確認項目チェックリスト

- [ ] `https://tukumana.si.aoyama.ac.jp/members` でページが表示される
- [ ] ロゴ画像が正しく表示される
- [ ] CSS が正しく適用されている
- [ ] ナビゲーションリンクが `/members/...` で動作する
- [ ] アップロードした画像が表示される
- [ ] QR コード生成が動作する
- [ ] ログイン/ログアウトが動作する

## 重要な注意事項

1. **環境変数 `BASE_PATH`** は必ずビルド時とランタイム時の両方で設定する必要があります
2. **Nginx の proxy_pass** は末尾の `/` に注意（`http://localhost:3000` であり `http://localhost:3000/` ではない）
3. **アップロードファイルのパス** は実際のデプロイ先（`/srv/m-pass`）に合わせる必要があります
