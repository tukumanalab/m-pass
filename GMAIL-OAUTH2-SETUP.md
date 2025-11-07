# Gmail OAuth2 設定ガイド

このガイドでは、M-Pass でメール送信機能を使用するために必要な Gmail API OAuth2 認証の設定方法を説明します。

## 概要

M-Pass はメンバー登録時に確認メールを送信します。このメール送信には Gmail API を使用し、OAuth2 認証で安全に認証を行います。

**なぜ OAuth2 を使うのか？**

- アプリパスワードよりもセキュアな認証方式
- きめ細かなアクセス権限の管理が可能
- トークンの自動更新に対応

## セットアップ手順

### 1. Google Cloud Console でプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 画面上部の「プロジェクトを選択」→「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `m-pass-mailer`）
4. 「作成」をクリック
5. 作成したプロジェクトを選択

### 2. Gmail API を有効化

1. 左側メニューから「API とサービス」→「ライブラリ」を選択
2. 検索ボックスに「Gmail API」と入力
3. 「Gmail API」を選択
4. 「有効にする」をクリック

### 3. OAuth 同意画面を設定

1. 左側メニューから「API とサービス」→「OAuth 同意画面」を選択
2. ユーザータイプを選択:
   - **内部**: G Suite / Google Workspace 組織内のみ
   - **外部**: 個人用 Gmail アカウントの場合（推奨）
3. 「作成」をクリック
4. アプリ情報を入力:
   - **アプリ名**: `.env`ファイルの`APP_NAME`の値を使用
   - **ユーザーサポートメール**: あなたのメールアドレス
   - **アプリのロゴ**: （任意）
   - **アプリのホームページ**: `.env`ファイルの`APP_HOME_URL`の値を使用
   - **アプリ プライバシー ポリシー**: `http://localhost:3000/privacy-policy` (本番環境では実際のURL)
   - **利用規約**: `.env`ファイルの`TERMS_OF_SERVICE_URL`の値を使用
   - **デベロッパーの連絡先情報**: あなたのメールアドレス
5. 「保存して次へ」をクリック
6. スコープ画面:
   - 特に追加不要（デフォルトのまま）
   - 「保存して次へ」をクリック
7. テストユーザー画面:
   - 「ADD USERS」をクリック
   - **メール送信に使用する Gmail アドレス**を追加
   - 「保存して次へ」をクリック
8. 概要を確認して「ダッシュボードに戻る」をクリック

### 4. OAuth 2.0 クライアント ID を作成

1. 左側メニューから「API とサービス」→「認証情報」を選択
2. 画面上部の「認証情報を作成」→「OAuth クライアント ID」を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. 名前: `M-Pass Web Client`
5. 承認済みのリダイレクト URI:
   - 「URI を追加」をクリック
   - `https://developers.google.com/oauthplayground` を入力
6. 「作成」をクリック
7. 表示されたダイアログで以下をコピーして保存:
   - ✅ **クライアント ID** (例: `xxxxx.apps.googleusercontent.com`)
   - ✅ **クライアント シークレット** (例: `GOCSPX-xxxxx`)

### 5. リフレッシュトークンを取得

#### OAuth 2.0 Playground を使用

1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) にアクセス
2. 右上の歯車アイコン（⚙️ Settings）をクリック
3. 以下の設定を変更:
   - ✅ **Use your own OAuth credentials** にチェック
   - **OAuth Client ID**: 先ほど作成したクライアント ID を入力
   - **OAuth Client secret**: クライアント シークレットを入力
4. 「Close」をクリック

#### Step 1: スコープを選択

5. 左側の「Step 1」で、「Gmail API v1」を展開
6. 以下のスコープを選択:
   ```
   https://mail.google.com/
   ```
7. 「Authorize APIs」をクリック

#### Step 2: Google アカウントでログイン

8. Google ログイン画面が表示される
   - **テストユーザーとして追加したアカウント**でログイン
9. 「このアプリは確認されていません」と表示される場合:
   - 「詳細」をクリック
   - 「M-Pass Mailer（安全でないページ）に移動」をクリック
   - （これは自分で作成したアプリなので安全です）
10. アクセス許可画面:
    - 「すべて選択」にチェック
    - 「続行」をクリック

#### Step 3: トークンを取得

11. Playground に戻ったら、左側の「Step 2」で
12. 「Exchange authorization code for tokens」をクリック
13. 右側に表示される **Refresh token** をコピーして保存
    ```
    1//xxxxx-yyyyy-zzzzz
    ```

### 6. 環境変数を設定

プロジェクトルートに `.env` ファイルを作成（または `.env.example` をコピー）:

```bash
cp .env.example .env
```

`.env` ファイルを編集して、取得した値を設定:

```env
# Gmail OAuth2設定
GMAIL_USER=your-email@gmail.com                        # メール送信に使うGmailアドレス
GMAIL_CLIENT_ID=xxxxx.apps.googleusercontent.com        # Step 4で取得
GMAIL_CLIENT_SECRET=GOCSPX-xxxxx                        # Step 4で取得
GMAIL_REFRESH_TOKEN=1//xxxxx-yyyyy-zzzzz               # Step 5で取得

# アプリケーションURL
APP_URL=http://localhost:3000

# アプリケーション情報（OAuth設定やプライバシーポリシーで使用）
APP_NAME=つくまなラボメンバーズサイト (LabMem)          # アプリケーション名
APP_HOME_URL=http://localhost:3000                     # アプリのホームページURL
CONTACT_EMAIL=your-contact@example.com                 # お問い合わせ用メールアドレス
TERMS_OF_SERVICE_URL=http://localhost:3000/api/terms-of-service-html  # 利用規約URL
```

### 7. 動作確認

```bash
# 開発サーバーを起動
npm run dev

# ブラウザで http://localhost:3000/register にアクセス
# メンバー登録を試してメール送信をテスト
```

## トラブルシューティング

### メールが送信されない

1. **環境変数が正しく設定されているか確認**

   ```bash
   # .envファイルを確認
   cat .env | grep GMAIL
   ```

2. **コンソールログを確認**

   ```
   Warning: Gmail OAuth2 credentials are not configured
   ```

   → 環境変数が設定されていない

3. **リフレッシュトークンの有効期限**
   - リフレッシュトークンは通常無期限ですが、以下の場合に無効になります:
     - 6 ヶ月間使用されなかった場合
     - ユーザーがアクセス権を取り消した場合
     - パスワードが変更された場合
       → 再度 OAuth 2.0 Playground でトークンを取得

### 「このアプリは確認されていません」エラー

- OAuth 同意画面で「公開ステータス」が「テスト」の場合、テストユーザーのみアクセス可能
- テストユーザーに使用する Gmail アドレスが追加されているか確認

### 「Access blocked: This app's request is invalid」エラー

- リダイレクト URI が正しく設定されているか確認
- `https://developers.google.com/oauthplayground` が承認済みの URI に含まれているか確認

## セキュリティのベストプラクティス

1. **環境変数ファイルを Git にコミットしない**

   - `.gitignore` に `.env` が含まれているか確認

   ```bash
   echo ".env" >> .gitignore
   ```

2. **本番環境では環境変数を安全に管理**

   - サーバーの環境変数として設定
   - CI/CD パイプラインのシークレット管理機能を使用

3. **定期的にトークンを更新**

   - セキュリティインシデントが発生した場合
   - 定期的なセキュリティ監査の一環として

4. **最小権限の原則**
   - 必要最小限のスコープ（`https://mail.google.com/`）のみを使用

## プライバシーポリシーと利用規約について

Google OAuth認証画面で必要な「アプリ プライバシー ポリシー」と「利用規約」は以下で提供されています：

### プライバシーポリシー

1. **Webページ版**: `http://localhost:3000/privacy-policy`
   - Next.jsアプリケーション内でスタイル付きで表示
   - 環境変数（CONTACT_EMAIL）が自動反映される

2. **動的HTML版**: `http://localhost:3000/api/privacy-policy-html`
   - APIルート経由で生成されるHTML
   - 環境変数（CONTACT_EMAIL, APP_HOME_URL）が自動反映される
   - Google OAuth設定での使用に推奨

3. **マークダウン版**: `PRIVACY-POLICY.md`
   - 開発者向けの詳細版
   - 法的要件とGmail API使用について詳細に記載

### 利用規約

1. **Webページ版**: `http://localhost:3000/terms-of-service`
   - Next.jsアプリケーション内でスタイル付きで表示
   - 環境変数（CONTACT_EMAIL, APP_HOME_URL）が自動反映される

2. **動的HTML版**: `http://localhost:3000/api/terms-of-service-html`
   - APIルート経由で生成されるHTML
   - 環境変数（CONTACT_EMAIL, APP_HOME_URL）が自動反映される
   - Google OAuth設定での使用に推奨

3. **マークダウン版**: `TERMS-OF-SERVICE.md`
   - 開発者向けの詳細版
   - 法的要件とGoogle サービス連携について詳細に記載

### OAuth 同意画面での設定

Google Cloud Console の OAuth 同意画面で以下のように設定してください：

```
アプリ名: [APP_NAMEの値]
アプリ プライバシー ポリシー: http://localhost:3000/api/privacy-policy-html
利用規約: http://localhost:3000/api/terms-of-service-html
```

本番環境では実際のドメインに変更：
```
アプリ名: [APP_NAMEの値]
アプリ プライバシー ポリシー: https://yourdomain.com/api/privacy-policy-html
利用規約: https://yourdomain.com/api/terms-of-service-html
```

**推奨**: 環境変数が自動反映される`/api/*-html`を使用してください。

## 参考リンク

- [Google Cloud Console](https://console.cloud.google.com/)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Node.js Google APIs Client](https://github.com/googleapis/google-api-nodejs-client)
- [Nodemailer OAuth2 Documentation](https://nodemailer.com/smtp/oauth2/)
