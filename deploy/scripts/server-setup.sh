#!/usr/bin/env bash
# Prepares a fresh Ubuntu server (ARM) once, run as the default "ubuntu" user:
#   bash server-setup.sh
# Installs Docker and the AWS CLI, adds swap, and schedules the nightly backup
# and certificate renewal. Safe to run again.
set -euo pipefail

app=/opt/event-planner
user=$(id -un)

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl unzip unattended-upgrades

# Docker Engine and the Compose plugin, from Docker's own repository.
if ! command -v docker >/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo systemctl enable --now docker
sudo usermod -aG docker "$user"

# AWS CLI, for copying backups to S3 with the server's role (no keys stored).
if ! command -v aws >/dev/null; then
  tmp=$(mktemp -d)
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "$tmp/awscli.zip"
  unzip -q "$tmp/awscli.zip" -d "$tmp"
  sudo "$tmp/aws/install"
  rm -rf "$tmp"
fi

# 2 GB of swap: room for a burst (a large import) without the kernel stopping
# a container for lack of memory.
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/90-swappiness.conf >/dev/null
sudo sysctl -q --system

# Security updates install themselves.
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

sudo mkdir -p "$app/scripts" "$app/backups"
sudo chown -R "$user:$user" "$app"

# Nightly backup at 02:30 UTC; certificate renewal check twice a day.
sudo tee /etc/cron.d/event-planner >/dev/null <<CRON
30 2 * * * $user $app/scripts/backup.sh >> $app/backups/backup.log 2>&1
17 3,15 * * * $user $app/scripts/renew-cert.sh >> $app/backups/renew.log 2>&1
CRON

echo
echo "Done. Sign out and in again (exit, then ssh again) so Docker works without sudo."
