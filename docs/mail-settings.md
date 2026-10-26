# メール送信・認証設定仕様書

本ドキュメントは、M-Pass アプリケーションにおけるメール送信機能の設計、現在の運用設定、環境変数、およびメール認証（SPF / DKIM / DMARC）の設定内容をまとめた仕様書です。

---

## 1. 概要と現在の送信アーキテクチャ

M-Pass では、新規登録時のメールアドレス確認やパスワードリセット、マイページ案内などのメール送信を行っています。

### 送信方式の概要
- **送信方式**: [Resend](https://resend.com/) の HTTP API + [lib/mailer.ts](../lib/mailer.ts)
- **ライブラリ**: `resend`（公式 Node.js SDK）
- **差出人（From ヘッダー）**: `${APP_NAME} <${MAIL_FROM}>`（`APP_NAME` 未設定時は `メンバー登録システム <${MAIL_FROM}>`）
- **返信先（Reply-To ヘッダー）**: `${CONTACT_EMAIL}`（未設定時は `${MAIL_FROM}`）
- **送信元アドレス**: 環境変数 `MAIL_FROM` にて指定。現在は `tukumana.si.aoyama.ac.jp` ドメインのアドレスを使用（Resend でドメイン認証済み）
- **Web サーバー**: `https://tukumana.si.aoyama.ac.jp/members` (Ubuntu + PM2 + Nginx)

> [!NOTE]
> 送信元ドメイン `tukumana.si.aoyama.ac.jp` は Resend 側で **Verified** 済みです。`MAIL_FROM` にはこのドメインのアドレスを指定してください。別ドメインから送信する場合や DNS レコードを再設定する場合は第 4 章を参照してください。

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

# Resend 設定（メール送信用）
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
MAIL_FROM=noreply@tukumana.si.aoyama.ac.jp
```

### 設定確認コマンド
アプリケーション起動環境で環境変数が正しくロードされているかは、以下のスクリプトで確認できます。
```bash
node scripts/check-env.js
```

---

## 4. メール認証（SPF / DKIM / DMARC）設定

`tukumana.si.aoyama.ac.jp` は Resend 側でドメイン登録・認証済みです。以下は、別ドメインを追加する場合や DNS レコードを再設定する場合の手順です。
受信サーバー側で **SPF: PASS / DKIM: PASS / DMARC: PASS** を達成するための手順です。

#### 必要権限
- Resend アカウントの管理権限
- `tukumana.si.aoyama.ac.jp` の DNS レコード編集権限（学内ネームサーバー管理責任者）

#### DNS ホスト名の入力仕様について
DNS サービスや学内ネームサーバー（青山学院大学情報メディアセンター等）の仕様によって、ホスト名フィールドの入力ルールが異なります。
- **パターンA（完全修飾ドメイン名 / FQDN 指定）**: 末尾にドメイン全体を記述（例: `tukumana.si.aoyama.ac.jp.`）
- **パターンB（親ゾーンからの相対名指定 / 親が `si.aoyama.ac.jp` の場合）**: サブドメイン部分のみを記述（例: `tukumana`）
- **パターンC（独立したゾーン `tukumana.si.aoyama.ac.jp` を管理している場合）**: apex（ゾーン直下）は `@` または空欄

#### 設定ステップ

##### Step 1: Resend にドメインを追加
1. [Resend ダッシュボード](https://resend.com/domains) で **[Add Domain]** をクリック。
2. ドメイン名に `tukumana.si.aoyama.ac.jp` を入力し、リージョンを選択（通常は Tokyo または US East）。
3. 画面に SPF 用の MX / TXT レコードと DKIM 用の TXT レコードが表示されます。

##### Step 2: DNS レコードの登録
Resend が表示する値をそのまま DNS に登録します。代表的なレコードは以下の通りです（実際の値は Resend の画面に従ってください）。

| 認証規格 | ホスト名（例） | 種別 | 設定値（Value） |
| :--- | :--- | :--- | :--- |
| **SPF** | `send.tukumana.si.aoyama.ac.jp` | MX | `feedback-smtp.<region>.amazonses.com`（優先度 10） |
| **SPF** | `send.tukumana.si.aoyama.ac.jp` | TXT | `v=spf1 include:amazonses.com ~all` |
| **DKIM** | `resend._domainkey.tukumana.si.aoyama.ac.jp` | TXT | `p=` で始まる公開鍵（Resend の画面に表示） |
| **DMARC** | `_dmarc.tukumana.si.aoyama.ac.jp` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc-reports@tukumana.si.aoyama.ac.jp` |

> [!WARNING]
> - Resend の SPF はサブドメイン `send.` 配下に設定するため、親ドメインの既存 SPF レコード（`si.aoyama.ac.jp` の Microsoft 365 設定など）とは競合しません。
> - 1つのホスト名に対して **SPF レコードは必ず1行** です。

##### Step 3: 認証の確認
1. DNS 反映後、Resend ダッシュボードで **[Verify DNS Records]** をクリック。
2. ステータスが **Verified** になれば完了です。
3. 反映確認コマンド:
   ```bash
   dig TXT resend._domainkey.tukumana.si.aoyama.ac.jp +short
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

### Q1: `Error: Resend is not configured` または `Resend error: ...` が発生する
- **原因**: `RESEND_API_KEY` / `MAIL_FROM` が未設定、API キーが無効、または `MAIL_FROM` のドメインが Resend で未認証です。
- **対処**:
  1. `node scripts/check-env.js` で各環境変数が `SET` になっているか確認。
  2. [Resend ダッシュボード](https://resend.com/api-keys) で API キーが有効か、[Domains](https://resend.com/domains) で `MAIL_FROM` のドメインが Verified かを確認。
  3. エラーログの `Resend error:` 以降に Resend からのエラー内容（例: `validation_error`）が出力されるので内容を確認。
  4. アプリケーション（PM2 等）を再起動。

### Q2: 独自ドメイン移行時に DMARC が FAIL になる
- **原因**: メールヘッダーの `From` ドメインと DKIM 署名（`d=` タグ）または SPF ドメインが一致（アライメント）していません。
- **対処**: 環境変数 `MAIL_FROM` のドメインが Resend で認証したドメインと完全に一致しているか確認してください。