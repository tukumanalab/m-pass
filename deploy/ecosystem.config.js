module.exports = {
  apps: [
    {
      name: 'm-pass',
      script: 'npm',
      args: 'start',
      cwd: '/path/to/m-pass',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_PATH: './checkin.db'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'm-pass-debug',
      script: 'npm',
      args: 'run start:debug',
      cwd: '/path/to/m-pass',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_PATH: './checkin-debug.db'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
}
