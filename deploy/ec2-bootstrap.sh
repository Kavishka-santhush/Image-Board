#!/usr/bin/env bash
# ============================================================
# One-time EC2 bootstrap — run MANUALLY on the instance:
#   ssh ec2-user@<EC2_HOST>
#   curl -fsSL <repo raw url>/deploy/ec2-bootstrap.sh | bash   (or paste)
#
# Idempotent: safe to re-run. Everything in this script is the
# "golden image by hand" — in production you'd bake an AMI or use
# cloud-user-data; for learning, running it once and understanding
# each line is the point.
#
# NOTE what this script does NOT do: no app files, no nginx config,
# no .env. The first pipeline deploy copies the nginx configs (GitOps:
# repo = source of truth), and secrets live only on the box.
# ============================================================
set -euo pipefail

echo "==> Packages (Node 20, Nginx, git, rsync)"
sudo dnf update -y
sudo dnf install -y nodejs npm nginx git rsync

echo "==> pm2 (process manager)"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> App directories (owned by ec2-user — deploys need no sudo)"
sudo mkdir -p /var/app/image-board /var/www/image-board
sudo chown -R ec2-user:ec2-user /var/app /var/www

echo "==> pm2 resurrection at boot (systemd)"
# `pm2 startup` prints a sudo command; executing its last line registers
# the systemd unit so pm2 restores our saved process list after reboot.
sudo env PATH="$PATH:$(dirname "$(command -v pm2)")" \
  pm2 startup systemd -u ec2-user --hp /home/ec2-user --no-prompt

echo "==> Firewall: Nginx serves immediately (security groups do the real filtering)"
sudo systemctl enable --now nginx

echo ""
echo "✅ Bootstrap done. Next: create /var/app/image-board/backend/.env"
echo "   (see docs/aws-setup.md § 6) — the pipeline fills in everything else."
