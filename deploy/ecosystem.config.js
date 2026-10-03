// pm2 process file — `pm2 start deploy/ecosystem.config.js --env production`
//
// WHY pm2 at all (vs `node server.js` in a tmux session):
// - restarts the app if it CRASHES (RDS blip → throw → process dies →
//   pm2 brings it back in 1s; a bare node process stays dead)
// - survives reboots via `pm2 startup` + `pm2 save` (systemd unit)
// - `pm2 reload`/`restart` is what the deploy pipeline calls — zero
//   manual SSH-and-kick-the-process deploys
// - logs: `pm2 logs image-board-backend` is how you debug production
module.exports = {
  apps: [
    {
      name: 'image-board-backend',
      script: 'src/server.js',
      cwd: '/var/app/image-board/backend',

      // t2/t3.micro = 1 vCPU and ~1GB RAM: cluster mode with N workers
      // would multiply the DB pool (N × max 5 connections) and eat a
      // micro RDS's entire connection budget. One forked process, full stop.
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },

      // micro-instance survival kit: if the app leaks past its share of
      // RAM, pm2 restarts it BEFORE the OOM killer takes down SSH with it
      max_memory_restart: '160M',

      // timestamps on log lines — CloudWatch-free forensics
      time: true,

      // graceful reload: give in-flight requests a moment; our
      // server.js handles SIGINT by destroying the DB pool
      kill_timeout: 5000,
    },
  ],
};
