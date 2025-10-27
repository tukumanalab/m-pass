/**
 * デフォルトの成功音・エラー音をpublicディレクトリにコピーするスクリプト
 * lib/resourceからpublic/soundsにデフォルト音声ファイルをコピー
 */

const fs = require('fs');
const path = require('path');

// ファイルをコピー
function copyDefaultSounds() {
  const resourceDir = path.join(__dirname, '../lib/resource');
  const soundsDir = path.join(__dirname, '../public/sounds');

  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
  }

  const successSrcPath = path.join(resourceDir, 'sound-success-default.wav');
  const errorSrcPath = path.join(resourceDir, 'sound-error-default.wav');
  const successDestPath = path.join(soundsDir, 'success.wav');
  const errorDestPath = path.join(soundsDir, 'error.wav');

  // 既存ファイルがある場合はスキップ
  if (fs.existsSync(successDestPath) && fs.existsSync(errorDestPath)) {
    console.log('デフォルト音声ファイルは既に存在します。');
    return;
  }

  console.log('デフォルト音声ファイルをコピー中...');

  // ソースファイルの存在確認
  if (!fs.existsSync(successSrcPath)) {
    console.error(`エラー: ${successSrcPath} が見つかりません`);
    process.exit(1);
  }
  if (!fs.existsSync(errorSrcPath)) {
    console.error(`エラー: ${errorSrcPath} が見つかりません`);
    process.exit(1);
  }

  // ファイルをコピー
  if (!fs.existsSync(successDestPath)) {
    fs.copyFileSync(successSrcPath, successDestPath);
    console.log('✓ success.wav をコピーしました (public/sounds/)');
  }

  if (!fs.existsSync(errorDestPath)) {
    fs.copyFileSync(errorSrcPath, errorDestPath);
    console.log('✓ error.wav をコピーしました (public/sounds/)');
  }

  console.log('\nデフォルト音声ファイルのコピーが完了しました。');
}

// スクリプトを実行
if (require.main === module) {
  copyDefaultSounds();
}

module.exports = { copyDefaultSounds };
