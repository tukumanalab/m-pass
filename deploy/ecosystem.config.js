module.exports = {
  apps: [
    {
      name: 'm-pass',
      script: 'npm',
      args: 'start',
      cwd: '/srv/m-pass',
      // .envファイルから環境変数を読み込む（相対パス）
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BASE_PATH: '/members',
        DB_PATH: './members.db',
        // Node.jsのメモリ制限を設定
        NODE_OPTIONS: '--max-old-space-size=400'  // さらに厳しく制限 (512MB → 400MB)
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '450M',  // 500M → 450M (より早く再起動)
      // ログ設定
      out_file: '~/.pm2/logs/m-pass-out.log',
      error_file: '~/.pm2/logs/m-pass-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // プロセスの優先度を下げる
      nice: 10,
      // 再起動時の遅延を追加してメモリスパイクを防ぐ
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // メモリ監視を強化
      kill_timeout: 5000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100
    },
    {
      name: 'm-pass-debug',
      script: 'npm',
      args: 'run start:debug',
      cwd: '/srv/m-pass',
      // .envファイルから環境変数を読み込む（相対パス）
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        BASE_PATH: '/members',
        DB_PATH: './members-debug.db',
        // Node.jsのメモリ制限を設定
        NODE_OPTIONS: '--max-old-space-size=400'  // さらに厳しく制限 (512MB → 400MB)
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '450M',  // 500M → 450M (より早く再起動)
      // ログ設定
      out_file: '~/.pm2/logs/m-pass-debug-out.log',
      error_file: '~/.pm2/logs/m-pass-debug-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // プロセスの優先度を下げる
      nice: 10,
      // 再起動時の遅延を追加してメモリスパイクを防ぐ
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // メモリ監視を強化
      kill_timeout: 5000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100
    }
  ]
}
