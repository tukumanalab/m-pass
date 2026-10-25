# メール送信・認証設定仕様書

本ドキュメントは、M-Pass アプリケーションにおけるメール送信機能の設計、現在の運用設定、環境変数、および将来的な独自ドメイン移行時のメール認証（SPF / DKIM / DMARC）設定手順をまとめた仕様書です。

---

## 1. 概要と現在の送信アーキテクチャ

M-Pass では、新規登録時のメールアドレス確認やパスワードリセット、マイページ案内などのメール送信を行っています。

### 送信方式の概要
- **送信方式**: Gmail API (OAuth 2.0) + [lib/mailer.ts](file:///Users/ky/Documents/workspace/m-pass/lib/mailer.ts)
- **ライブラリ**: `nodemailer` + `googleapis` (OAuth2 クライアント)
- **差出人（From ヘッダー）**: `"${APP_NAME}" <${GMAIL_USER}>`（未設定時は `"メンバー登録システム" <${GMAIL_USER}>`）
- **返信先（Reply-To ヘッダー）**: `${CONTACT_EMAIL}`（未設定時は `${GMAIL_USER}`）
- **現在の送信元アドレス**: `tukumanalab@gmail.com`（環境変数 `GMAIL_USER` にて指定）
- **Web サーバー**: `https://tukumana.si.aoyama.ac.jp/members` (Ubuntu + PM2 + Nginx)

> [!NOTE]
> 現在の運用では送信元に Gmail アドレス（`tukumanalab@gmail.com`）を使用しているため、Google 側のインフラによって **SPF / DKIM（gmail.com ドメイン）が自動的に署名・認証**されます。そのため、現行の送信元アドレスを使用する限り、DNS サーバーへの追加 TXT レコード登録なしで受信サーバー側での認証（PASS）が満たされます。

---

## 2. 送信されるメール種別と仕様

すべてのメールは HTML 形式およびプレーンテキスト（text）形式のマルチパート（`multipart/alternative`）で送信され、共通フッターが自動付与されます。また、HTMLメール内にはボタンが表示されない環境やリンク隠蔽判定を防ぐため、直リンクURLをテキストでも併記しています。

> メールアドレスが空（メール未登録）のメンバーには、マイページ案内メール等のメールは送信されません。パスワードリセットも利用できないため、管理者への問い合わせが必要です。

### 共通フッター (`getEmailFooter` / `getTextEmailFooter`)
- プライバシーポリシーリンク（`${APP_URL}/privacy-policy`）
- 利用規約リンク（`${APP_URL}/terms-of-service`）
- 自動送信・直接返信不可の注意文言
- お問い合わせ先メールアドレス（`${CONTACT_EMAIL}`）

### メール一覧

| メール種別 | 送信契機 | 実装関数 | 件名 | 有効期限・主な内容 |
| :--- | :--- | :--- | :--- | :--- |
| **登録確認メール** | `/register` での登録フォーム送信時（非同期） | `sendVerificationEmail` | メンバー登録の確認 | **有効期限: 24時間**<br>確認URL（`${APP_URL}/register/verify?token=...`） |
| **登録完了メール** | `/register/verify` での確認完了時 | `sendRegistrationCompleteEmail` | メンバー登録完了のお知らせ | メンバーID、お名前、所属、ログインページリンク |
| **パスワードリセット（単一）** | パスワード再設定要求時 | `sendPasswordResetEmail` | パスワードリセットのお知らせ | **有効期限: 1時間**<br>リセットURL（`${APP_URL}/member/reset-password?token=...`） |
| **パスワードリセット（複数）** | 同一メールアドレスで複数アカウント存在時 | `sendPasswordResetEmailMultiple` | パスワードリセットのお知らせ | **有効期限: 1時間**<br>各アカウントごとのリセットURL一覧 |
| **メールアドレス変更確認** | マイページからのメアド変更時 | `sendEmailChangeVerificationEmail` | メールアドレス変更の確認 | **有効期限: 1時間**<br>確認URL（`${APP_URL}/member/verify-email?token=...`） |
| **マイページ案内メール** | 管理画面等からの案内送信時 | `sendMyPageAnnouncementEmail` | 【重要】メンバー専用マイページのご案内 | ログインID、初期パスワード（メールアドレス）、マイページ機能説明 |

---

## 3. 環境変数設定（.env）

メール送信に必要な環境変数は以下の通りです。

```env
# アプリケーションのベースURL（メール内リンクの生成に使用）
APP_URL=https://tukumana.si.aoyama.ac.jp/members

# アプリケーション情報
APP_NAME=つくまなラボメンバーズサイト (LabMem)
APP_HOME_URL=https://tukumana.si.aoyama.ac.jp/members
CONTACT_EMAIL=tukumanalab@gmail.com
TERMS_OF_SERVICE_URL=https://tukumana.si.aoyama.ac.jp/members/api/terms-of-service-html

# Gmail OAuth2 設定（メール送信用）
GMAIL_USER=tukumanalab@gmail.com
GMAIL_CLIENT_ID=xxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxx
GMAIL_REFRESH_TOKEN=1//xxxxx-yyyyy-zzzzz
```

### 設定確認コマンド
アプリケーション起動環境で環境変数が正しくロードされているかは、以下のスクリプトで確認できます。
```bash
node scripts/check-env.js
```

---

## 4. メール認証（SPF / DKIM / DMARC）設定

### 4-1. 現行構成（`@gmail.com` 送信）の場合
- 送信元が `@gmail.com` ドメインである場合、Gmail の SMTP/API 経由で送信されるメールには Google の DKIM 署名（`d=gmail.com`）および Google の SPF が自動的に適用されます。
- 追加の DNS 設定は不要です。

---

### 4-2. 独自ドメイン（`@tukumana.si.aoyama.ac.jp`）から送信する場合

将来的に送信元アドレス（`GMAIL_USER`）を `noreply@tukumana.si.aoyama.ac.jp` などの独自ドメインに変更し、Google Workspace を配信基盤として利用する場合の手順です。
受信サーバー側で **SPF: PASS / DKIM: PASS / DMARC: PASS** を達成するために、DNS レコードの設定が必要となります。

#### 必要権限
- Google Workspace 特権管理者権限（Google 管理コンソールへのアクセス）
- `tukumana.si.aoyama.ac.jp` の DNS レコード編集権限（学内ネームサーバー管理責任者）

#### DNS ホスト名の入力仕様について
DNS サービスや学内ネームサーバー（青山学院大学情報メディアセンター等）の仕様によって、ホスト名フィールドの入力ルールが異なります。
- **パターンA（完全修飾ドメイン名 / FQDN 指定）**: 末尾にドメイン全体を記述（例: `tukumana.si.aoyama.ac.jp.`）
- **パターンB（親ゾーンからの相対名指定 / 親が `si.aoyama.ac.jp` の場合）**: サブドメイン部分のみを記述（例: `tukumana`）
- **パターンC（独立したゾーン `tukumana.si.aoyama.ac.jp` を管理している場合）**: apex（ゾーン直下）は `@` または空欄

#### DNS レコード設定クイックリファレンス

| 認証規格 | ホスト名（FQDN指定の場合） | ホスト名（tukumana ゾーン管理の場合） | 種別 | TTL | 設定値（Value） |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SPF** | `tukumana.si.aoyama.ac.jp` | `@`（または空欄） | TXT | 3600 | `v=spf1 include:_spf.google.com ~all` |
| **DKIM** | `google._domainkey.tukumana.si.aoyama.ac.jp` | `google._domainkey` | TXT | 3600 | `v=DKIM1; k=rsa; p=Google管理画面で生成した公開鍵` |
| **DMARC** | `_dmarc.tukumana.si.aoyama.ac.jp` | `_dmarc` | TXT | 3600 | `v=DMARC1; p=none; rua=mailto:dmarc-reports@tukumana.si.aoyama.ac.jp` |

> [!WARNING]
> - 1つのドメインに対して **SPF レコードは必ず1行** です。すでに他の送信元がある場合は、1行の中に `include:` を追加してください。
> - 親ドメイン `si.aoyama.ac.jp` では Microsoft 365 (`spf.protection.outlook.com`) が使用されています。サブドメイン `tukumana.si.aoyama.ac.jp` を独自に定義する場合は、親ドメインの設定と競合しないようサブドメインのレコードとして登録してください。

#### 詳細設定ステップ

##### Step 1: SPF レコードの設定
1. DNS 管理画面で TXT レコードを追加します。
   - **ホスト名**: `tukumana.si.aoyama.ac.jp`（または `@` / 空欄）
   - **種別**: `TXT`
   - **値**: `v=spf1 include:_spf.google.com ~all`
2. 反映確認:
   ```bash
   dig TXT tukumana.si.aoyama.ac.jp +short
   ```

##### Step 2: DKIM レコードの生成・登録・有効化
1. [Google 管理コンソール](https://admin.google.com) に特権管理者でログイン。
2. **[メニュー]** > **[アプリ]** > **[Google Workspace]** > **[Gmail]** > **[メールの認証]** を開く。
3. ドメイン `tukumana.si.aoyama.ac.jp` を選択し、**[新しいレコードを生成]** をクリック。
   - キー長: `2048`（DNSが非対応の場合は `1024`）
   - プレフィックスセレクタ: `google`
4. 表示された TXT レコード（ホスト名: `google._domainkey`、値: `v=DKIM1; k=rsa; p=...`）を DNS 管理画面に登録。
5. 反映確認:
   ```bash
   dig TXT google._domainkey.tukumana.si.aoyama.ac.jp +short
   ```
6. 反映後、Google 管理コンソールの **[認証を開始]** をクリックし、ステータスが「メールを DKIM で認証しています」になることを確認。

##### Step 3: DMARC レコードの設定
1. DNS 管理画面で TXT レコードを追加します。
   - **ホスト名**: `_dmarc.tukumana.si.aoyama.ac.jp`（または `_dmarc`）
   - **種別**: `TXT`
   - **値**: `v=DMARC1; p=none; rua=mailto:dmarc-reports@tukumana.si.aoyama.ac.jp`
2. 反映確認:
   ```bash
   dig TXT _dmarc.tukumana.si.aoyama.ac.jp +short
   ```

---

## 5. 疎通確認とヘッダー検証手順

### 5-1. テストメール送信
1. テスト用の登録申請、またはパスワードリセットを実行し、テスト宛先（個人の Gmail アカウント等）へメールを送信します。

### 5-2. 受信側でのヘッダー確認（Gmail の場合）
1. 受信したメールをブラウザの Gmail で開きます。
2. 本文右上の **その他アイコン（︙ / 縦の3点リーダー）** > **[元のメッセージを表示]** をクリック。
3. 上部の認証サマリー表を確認します。

```text
SPF:   PASS（送信元ドメインとIPの整合性）
DKIM:  'PASS'（署名ドメインとの一致）
DMARC: 'PASS'
```

---

## 6. トラブルシューティング

### Q1: `Error: Failed to get Gmail access token` が発生する
- **原因**: OAuth2 のリフレッシュトークンが無効化されている、または環境変数が未設定です。
- **対処**:
  1. `node scripts/check-env.js` で各環境変数が `SET` になっているか確認。
  2. [GMAIL-OAUTH2-SETUP.md](file:///Users/ky/Documents/workspace/m-pass/GMAIL-OAUTH2-SETUP.md) の手順に従い、Google OAuth 2.0 Playground で新しいリフレッシュトークンを再取得して `.env` を更新。
  3. アプリケーション（PM2 等）を再起動。

### Q2: 独自ドメイン移行時に DMARC が FAIL になる
- **原因**: メールヘッダーの `From` ドメインと DKIM 署名（`d=` タグ）または SPF ドメインが一致（アライメント）していません。
- **対処**: `lib/mailer.ts` の `from` 設定と、環境変数 `GMAIL_USER` のドメインが DNS 設定を行ったドメインと完全に一致しているか確認してください。