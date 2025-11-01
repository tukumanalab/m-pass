module.exports = {
  apps: [
    {
      name: 'm-pass',
      script: 'npm',
      args: 'start',
      cwd: '/srv/m-pass',
      // .envファイルから環境変数を読み込む
      env_file: '/srv/m-pass/.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BASE_PATH: '/members',
        DB_PATH: `members.db`,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
