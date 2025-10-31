module.exports = {
  apps: [
    {
      name: 'm-pass',
      script: 'npm',
      args: 'start',
      cwd: '/srv/m-pass',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BASE_PATH: '/members',
        DB_PATH: './members.db',
        // Node.jsのメモリ制限を設定
        NODE_OPTIONS: '--max-old-space-size=512'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      // プロセスの優先度を下げる
      nice: 10,
      // 再起動時の遅延を追加してメモリスパイクを防ぐ
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    },
    {
      name: 'm-pass-debug',
      script: 'npm',
      args: 'run start:debug',
      cwd: '/srv/m-pass',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        BASE_PATH: '/members',
        DB_PATH: './members-debug.db',
        // Node.jsのメモリ制限を設定
        NODE_OPTIONS: '--max-old-space-size=512'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      // プロセスの優先度を下げる
      nice: 10,
      // 再起動時の遅延を追加してメモリスパイクを防ぐ
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
}
