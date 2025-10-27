module.exports = {
  apps: [
    {
      name: 'fscoreboard',
      script: 'server/app.js',
      cwd: './',
      env: {
        PORT: 3002,
        TOKEN: 'MySecret111'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};