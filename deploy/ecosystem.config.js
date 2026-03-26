module.exports = {
  apps: [
    {
      name: 'scrumify-api',
      cwd: '/home/scrumify/app/apps/api',
      script: 'dist/src/main.js',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'scrumify-web',
      cwd: '/home/scrumify/app/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
