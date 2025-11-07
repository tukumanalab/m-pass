import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `利用規約 | ${process.env.APP_NAME || 'つくまなラボメンバーズサイト'}`,
  description: `${process.env.APP_NAME || 'つくまなラボメンバーズサイト（LabMem）'}の利用規約`,
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">利用規約</h1>
      <p className="text-sm text-gray-600 mb-8">最終更新日: 2025年11月7日</p>

      <div className="prose prose-lg max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第1条（適用）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            本利用規約（以下「本規約」）は、Tukumana Lab（以下「当団体」）が運営する
            {process.env.APP_NAME || 'つくまなラボメンバーズサイト（LabMem）'}（以下「本サービス」）の利用条件を定めるものです。
            本サービスをご利用になる場合には、本規約に同意いただいたものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第2条（サービス内容）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            本サービスは、会員管理およびチェックイン機能を提供するWebアプリケーションです。
          </p>
          <h3 className="text-xl font-medium mb-3 text-gray-800">主な機能</h3>
          <ul className="mb-6 ml-6 text-gray-700 space-y-2">
            <li>• 会員登録およびアカウント管理</li>
            <li>• チェックイン・チェックアウト機能</li>
            <li>• 利用履歴の記録・閲覧</li>
            <li>• QRコードを使用した認証</li>
            <li>• メール通知機能</li>
            <li>• 管理者向け会員管理機能</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第3条（利用登録）</h2>
          <ol className="mb-6 ml-6 text-gray-700 space-y-3">
            <li>1. 本サービスの利用を希望する方は、当団体が定める方法により利用登録を申請し、当団体がこれを承認することによって利用登録が完了します。</li>
            <li>2. 利用登録の申請にあたっては、真実、正確かつ最新の情報を提供するものとします。</li>
            <li>3. 当団体は、利用登録の申請者が以下の事由に該当する場合には、利用登録の申請を承認しないことがあります。
              <ul className="mt-2 ml-6 space-y-1">
                <li>• 利用登録の申請に際して虚偽の事項を届け出た場合</li>
                <li>• 過去に本規約に違反したことがある場合</li>
                <li>• その他、当団体が利用登録を相当でないと判断した場合</li>
              </ul>
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第4条（アカウント管理）</h2>
          <ol className="mb-6 ml-6 text-gray-700 space-y-3">
            <li>1. ユーザーは、自己の責任において、本サービスのアカウント情報を適切に管理するものとします。</li>
            <li>2. ユーザーは、いかなる場合にも、アカウント情報を第三者に譲渡または貸与することはできません。</li>
            <li>3. アカウント情報の管理不十分、使用上の過誤、第三者の使用等によって生じた損害について、当団体は一切の責任を負いません。</li>
          </ol>
        </section>

        <section className="mb-8 bg-blue-50 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第5条（外部サービスとの連携）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            本サービスは、機能向上のため以下の外部サービスと連携します：
          </p>
          
          <h3 className="text-xl font-medium mb-3 text-gray-800">Google サービス</h3>
          <ul className="mb-4 ml-6 text-gray-700 space-y-2">
            <li>• <strong>Gmail API</strong>: 会員登録確認メール、パスワードリセットメール等の送信</li>
            <li>• <strong>使用目的</strong>: システムからユーザーへの重要な通知の配信</li>
            <li>• <strong>データアクセス</strong>: ユーザーの個人的なGoogleアカウント情報にはアクセスしません</li>
          </ul>

          <h3 className="text-xl font-medium mb-3 text-gray-800">連携に関する同意</h3>
          <p className="mb-4 text-gray-700 leading-relaxed">
            本サービスをご利用いただく際は、上記外部サービスとの連携に同意いただいたものとみなします。
            各外部サービスの利用規約およびプライバシーポリシーもあわせてご確認ください。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第6条（禁止事項）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません：
          </p>
          <ul className="mb-6 ml-6 text-gray-700 space-y-2">
            <li>• 法令または公序良俗に違反する行為</li>
            <li>• 犯罪行為に関連する行為</li>
            <li>• 本サービスの内容等、本サービスに含まれる著作権、商標権その他の知的財産権を侵害する行為</li>
            <li>• 当団体、ほかのユーザー、またはその他第三者のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
            <li>• 本サービスによって得られた情報を商業的に利用する行為</li>
            <li>• 当団体のサービスの運営を妨害するおそれのある行為</li>
            <li>• 不正アクセスをし、またはこれを試みる行為</li>
            <li>• 他のユーザーに関する個人情報等を収集または蓄積する行為</li>
            <li>• 不正な目的を持って本サービスを利用する行為</li>
            <li>• 本サービスの他のユーザーまたはその他の第三者に不利益、損害、不快感を与える行為</li>
            <li>• その他、当団体が不適切と判断する行為</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第7条（本サービスの提供の停止等）</h2>
          <ol className="mb-6 ml-6 text-gray-700 space-y-3">
            <li>1. 当団体は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
              <ul className="mt-2 ml-6 space-y-1">
                <li>• 本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
                <li>• 地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
                <li>• コンピュータまたは通信回線等が事故により停止した場合</li>
                <li>• その他、当団体が本サービスの提供が困難と判断した場合</li>
              </ul>
            </li>
            <li>2. 当団体は、本サービスの提供の停止または中断により、ユーザーまたは第三者が被ったいかなる不利益または損害についても、一切の責任を負わないものとします。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第8条（利用制限および登録抹消）</h2>
          <ol className="mb-6 ml-6 text-gray-700 space-y-3">
            <li>1. 当団体は、ユーザーが以下のいずれかに該当する場合には、事前の通知なく、ユーザーに対して、本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を抹消することができるものとします。
              <ul className="mt-2 ml-6 space-y-1">
                <li>• 本規約のいずれかの条項に違反した場合</li>
                <li>• 登録事項に虚偽の事実があることが判明した場合</li>
                <li>• 料金等の支払債務の不履行があった場合</li>
                <li>• 当団体からの連絡に対し、一定期間返答がない場合</li>
                <li>• 本サービスについて、最後の利用から一定期間利用がない場合</li>
                <li>• その他、当団体が本サービスの利用を適当でないと判断した場合</li>
              </ul>
            </li>
            <li>2. 当団体は、本条に基づき当団体が行った行為によりユーザーに生じた損害について、一切の責任を負いません。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第9条（退会）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            ユーザーは、当団体の定める退会手続により、本サービスから退会できるものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第10条（保証の否認および免責事項）</h2>
          <ol className="mb-6 ml-6 text-gray-700 space-y-3">
            <li>1. 当団体は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）がないことを明示的にも黙示的にも保証しておりません。</li>
            <li>2. 当団体は、本サービスに起因してユーザーに生じたあらゆる損害について、当団体の故意または重過失による場合を除き、一切の責任を負いません。</li>
            <li>3. 当団体は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第11条（サービス内容の変更等）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            当団体は、ユーザーへの事前の告知をもって、本サービスの内容を変更、追加または廃止することがあり、ユーザーはこれに同意するものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第12条（利用規約の変更）</h2>
          <ol className="mb-6 ml-6 text-gray-700 space-y-3">
            <li>1. 当団体は以下の場合には、ユーザーの個別の同意を要することなく、本規約を変更することができるものとします。
              <ul className="mt-2 ml-6 space-y-1">
                <li>• 本規約の変更がユーザーの一般の利益に適合するとき</li>
                <li>• 本規約の変更が本サービス利用契約の目的に反せず、かつ、変更の必要性、変更後の内容の相当性その他の変更に係る事情に照らして合理的なものであるとき</li>
              </ul>
            </li>
            <li>2. 前項による本規約の変更にあたっては、事前に本規約を変更する旨および変更後の本規約の内容並びにその効力発生時期をウェブサイト上での掲示その他の適切な方法により周知するものとします。</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第13条（個人情報の取扱い）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            当団体は、本サービスの利用によって取得する個人情報については、当団体の
            <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">プライバシーポリシー</a>
            に従い適切に取り扱うものとします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第14条（通知または連絡）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            ユーザーと当団体との間の通知または連絡は、当団体の定める方法によって行うものとします。
            当団体は、ユーザーから、当団体が別途定める方式に従った変更届け出がない限り、
            現在登録されている連絡先が有効なものとみなして当該連絡先へ通知または連絡を行い、
            これらは、発信時にユーザーへ到達したものとみなします。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第15条（権利義務の譲渡の禁止）</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            ユーザーは、当団体の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し、または担保に供することはできません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">第16条（準拠法・裁判管轄）</h2>
          <ol className="mb-6 ml-6 text-gray-700 space-y-3">
            <li>1. 本規約の解釈にあたっては、日本法を準拠法とします。</li>
            <li>2. 本サービスに関して紛争が生じた場合には、当団体の本店所在地を管轄する裁判所を専属的合意管轄とします。</li>
          </ol>
        </section>

        <section className="mb-8 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">お問い合わせ</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            本利用規約に関するお問い合わせは、以下までご連絡ください：
          </p>
          <div className="mb-4">
            <p className="font-semibold text-gray-800">Tukumana Lab</p>
            <p className="text-gray-700">ホームページ: {process.env.APP_HOME_URL || 'http://localhost:3000'}</p>
            <p className="text-gray-700">メール: {process.env.CONTACT_EMAIL || '[お問い合わせ用メールアドレス]'}</p>
            <p className="text-gray-700">対応時間: 平日 9:00-17:00</p>
          </div>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          この利用規約は、Google OAuth認証および日本の法律に準拠して作成されています。
        </p>
      </div>
    </div>
  );
}