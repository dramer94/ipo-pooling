#!/bin/bash

# ===========================================
# IPO Pooling VPS Deployment Script
# ===========================================
# Deploy the IPO Pooling React app to ipo.ifcpo.com.my
#
# Usage:
#   ./deploy.sh              # Full deployment
#   ./deploy.sh update       # Quick update (git pull + build + restart)
#   ./deploy.sh restart      # Just restart the app
#   ./deploy.sh logs         # View PM2 logs
#
# ===========================================

set -e

# Configuration
VPS_IP="5.223.72.252"
VPS_USER="root"
APP_NAME="ipo-pooling"
APP_DIR="/var/www/ipo-pooling"
BRANCH="main"
PORT=3003

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ===========================================
# FUNCTIONS
# ===========================================

check_ssh() {
    echo_info "Testing SSH connection to $VPS_IP..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes $VPS_USER@$VPS_IP "echo 'Connected!'" 2>/dev/null; then
        echo_error "Cannot connect to VPS at $VPS_IP"
        exit 1
    fi
    echo_info "SSH connection successful!"
}

clone_or_pull() {
    echo_info "Getting latest code..."
    ssh $VPS_USER@$VPS_IP "
        if [ -d '$APP_DIR/.git' ]; then
            cd '$APP_DIR'
            git fetch origin
            git checkout $BRANCH
            git pull origin $BRANCH
        else
            mkdir -p /var/www
            git clone -b $BRANCH https://github.com/dramer94/ipo-pooling.git '$APP_DIR'
            cd '$APP_DIR'
        fi
    "
}

install_deps() {
    echo_info "Installing dependencies..."
    ssh $VPS_USER@$VPS_IP "cd '$APP_DIR' && npm ci"
}

build_app() {
    echo_info "Building application..."
    ssh $VPS_USER@$VPS_IP "cd '$APP_DIR' && npm run build"
}

start_app() {
    echo_info "Starting application with PM2..."
    ssh $VPS_USER@$VPS_IP "
        cd '$APP_DIR'

        if pm2 describe $APP_NAME > /dev/null 2>&1; then
            echo 'Restarting existing PM2 process...'
            pm2 restart $APP_NAME
        else
            echo 'Starting new PM2 process...'
            pm2 start 'npm run preview' --name $APP_NAME --cwd '$APP_DIR'
            pm2 save
        fi
    "
}

restart_app() {
    echo_info "Restarting application..."
    ssh $VPS_USER@$VPS_IP "pm2 restart $APP_NAME && pm2 save"
}

show_status() {
    echo ""
    echo_info "=== Deployment Complete ==="
    echo ""
    ssh $VPS_USER@$VPS_IP "pm2 status | grep $APP_NAME"
    echo ""
    echo_info "App running at: https://ipo.ifcpo.com.my"
    echo_info "Logs: pm2 logs $APP_NAME"
    echo_info "Monitor: pm2 monit"
    echo ""
}

show_logs() {
    echo_info "Fetching PM2 logs..."
    ssh $VPS_USER@$VPS_IP "pm2 logs $APP_NAME --lines 50"
}

# ===========================================
# MAIN
# ===========================================

case "${1:-full}" in
    update)
        echo_info "=== Quick Update ==="
        check_ssh
        clone_or_pull
        install_deps
        build_app
        restart_app
        show_status
        ;;
    restart)
        echo_info "=== Restart Only ==="
        check_ssh
        restart_app
        show_status
        ;;
    logs)
        echo_info "=== View Logs ==="
        check_ssh
        show_logs
        ;;
    full|*)
        echo_info "=== Full Deployment ==="
        check_ssh
        clone_or_pull
        install_deps
        build_app
        start_app
        show_status
        ;;
esac
