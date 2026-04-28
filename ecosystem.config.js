module.exports = {
  apps: [
    {
      name: "pokemon-rayquaza-monitor",
      script: "dist-api/api/server.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3333
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3333,
        ENABLE_SCHEDULER: "false",
        ENABLE_BETA_SAFE_MODE: "true",
        ENABLE_ADMIN_DANGEROUS_ACTIONS: "false",
        RUN_ON_BOOT: "false",
        HEADLESS: "true",
        max_memory_restart: "1100M"
      },
      error_file: "./storage/pm2-error.log",
      out_file: "./storage/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
