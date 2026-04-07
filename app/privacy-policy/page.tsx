import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `プライバシーポリシー | ${process.env.APP_NAME || 'つくまなラボメンバーズサイト'}`,
  description: `${process.env.APP_NAME || 'つくまなラボメンバーズサイト（LabMem）'}のプライバシーポリシー`,
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">プライバシーポリシー</h1>
      <p className="text-sm text-gray-600 mb-8">最終更新日: 2025年11月7日</p>

      <div className="prose prose-lg max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">はじめに</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            {process.env.APP_NAME || 'つくまなラボメンバーズサイト（LabMem）'}（以下「本サービス」）は、Tukumana Lab（以下「当団体」）が運営する会員管理システムです。
            本プライバシーポリシーは、本サービスがユーザーの個人情報をどのように収集、使用、保護するかについて説明します。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">収集する情報</h2>
          
          <h3 className="text-xl font-medium mb-3 text-gray-800">ユーザーが提供する情報</h3>
          <p className="mb-4 text-gray-700 leading-relaxed">本サービスでは、以下の情報を収集します：</p>
          <ul className="mb-6 ml-6 text-gray-700 space-y-2">
            <li>• <strong>基本情報</strong>: 名前、メールアドレス</li>
            <li>• <strong>認証情報</strong>: パスワード（暗号化して保存）</li>
            <li>• <strong>会員情報</strong>: 会員ID、登録日時</li>
            <li>• <strong>利用履歴</strong>: チェックイン/チェックアウト記録、システム利用ログ</li>
          </ul>

          <h3 className="text-xl font-medium mb-3 text-gray-800">自動的に収集される情報</h3>
          <ul className="mb-6 ml-6 text-gray-700 space-y-2">
            <li>• <strong>技術情報</strong>: IPアドレス、ブラウザ情報、アクセス日時</li>
            <li>• <strong>利用状況</strong>: ページ閲覧履歴、機能の使用状況</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">情報の使用目的</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">収集した個人情報は、以下の目的で使用します：</p>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium mb-3 text-gray-800">サービス提供のため</h3>
            <ul className="mb-4 ml-6 text-gray-700 space-y-2">
              <li>• 会員認証とアカウント管理</li>
              <li>• チェックイン/チェックアウト機能の提供</li>
              <li>• 利用履歴の記録と表示</li>
              <li>• QRコード生成とスキャン機能</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-medium mb-3 text-gray-800">通信のため</h3>
            <ul className="mb-4 ml-6 text-gray-700 space-y-2">
              <li>• <strong className="text-blue-600">会員登録時の確認メール送信</strong></li>
              <li>• パスワードリセット通知</li>
              <li>• 重要なお知らせの配信</li>
              <li>• システムメンテナンス情報の通知</li>
            </ul>
          </div>
        </section>

        <section className="mb-8 bg-blue-50 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Google サービスとの連携</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            本サービスは、メール送信機能のために <strong>Gmail API</strong> を使用します：
          </p>
          
          <div className="mb-4">
            <h3 className="text-xl font-medium mb-3 text-gray-800">使用するGoogleサービス</h3>
            <ul className="mb-4 ml-6 text-gray-700 space-y-2">
              <li>• <strong>Gmail API</strong>: 確認メールやパスワードリセットメール等の送信</li>
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-medium mb-3 text-gray-800">アクセスするGoogleデータ</h3>
            <ul className="mb-4 ml-6 text-gray-700 space-y-2">
              <li>• <strong>送信するメールのコンテンツ</strong>: 当団体が作成するメール内容のみ</li>
              <li>• <strong className="text-red-600">注意</strong>: ユーザーのGmailアカウントやメール内容にはアクセスしません</li>
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-medium mb-3 text-gray-800">認証とセキュリティ</h3>
            <ul className="mb-4 ml-6 text-gray-700 space-y-2">
              <li>• OAuth 2.0による安全な認証</li>
              <li>• 最小限の権限（メール送信のみ）でのアクセス</li>
              <li>• 送信メールはシステムに保存されません</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">情報の共有と開示</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            以下の場合を除き、個人情報を第三者に提供することはありません：
          </p>
          <ul className="mb-6 ml-6 text-gray-700 space-y-2">
            <li>• ユーザーの同意がある場合</li>
            <li>• 法令に基づく要請がある場合</li>
            <li>• 生命、身体または財産の保護のために必要な場合</li>
          </ul>

          <h3 className="text-xl font-medium mb-3 text-gray-800">サービスプロバイダー</h3>
          <p className="mb-4 text-gray-700 leading-relaxed">
            以下のサービスプロバイダーと必要最小限の情報を共有する場合があります：
          </p>
          <ul className="mb-4 ml-6 text-gray-700 space-y-2">
            <li>• <strong>Google LLC</strong>: メール送信サービス（Gmail API）</li>
            <li>• <strong>クラウドホスティングプロバイダー</strong>: サーバー運用のため</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">データの保護</h2>
          <ul className="mb-6 ml-6 text-gray-700 space-y-2">
            <li>• <strong>暗号化</strong>: パスワードの暗号化保存</li>
            <li>• <strong>アクセス制御</strong>: 管理者権限の適切な管理</li>
            <li>• <strong>HTTPS通信</strong>: すべての通信の暗号化</li>
            <li>• <strong>セキュアトークン</strong>: JWTを使用した安全な認証</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">ユーザーの権利</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">ユーザーは以下の権利を有します：</p>
          <ul className="mb-6 ml-6 text-gray-700 space-y-2">
            <li>• <strong>アクセス権</strong>: 自分の個人情報の確認、利用履歴の閲覧</li>
            <li>• <strong>修正権</strong>: 登録情報の変更、パスワードの変更</li>
            <li>• <strong>削除権</strong>: アカウントの削除要求、個人情報の削除要求</li>
            <li>• <strong>データポータビリティ</strong>: データのエクスポート</li>
          </ul>
        </section>

        <section className="mb-8 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">お問い合わせ</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            プライバシーに関するご質問やご要望は、以下までご連絡ください：
          </p>
          <div className="mb-4">
            <p className="font-semibold text-gray-800">Tukumana Lab</p>
            <p className="text-gray-700">メール: {process.env.CONTACT_EMAIL || '[お問い合わせ用メールアドレス]'}</p>
            <p className="text-gray-700">対応時間: 平日 9:00-17:00</p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">適用される法律</h2>
          <p className="text-gray-700 leading-relaxed">
            本プライバシーポリシーは、日本国の個人情報保護法に準拠しています。
          </p>
        </section>
      </div>
    </div>
  );
}