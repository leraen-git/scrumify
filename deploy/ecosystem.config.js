module.exports = {
  apps: [
    {
      name: 'argo-api',
      cwd: '/home/argo/app/apps/api',
      script: 'dist/src/main.js',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'argo-web',
      cwd: '/home/argo/app/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
