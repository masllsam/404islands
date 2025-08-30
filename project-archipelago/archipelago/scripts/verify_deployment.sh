#!/bin/bash

# ============================================================
# ARCHIPELAGO DEPLOYMENT VERIFICATION SCRIPT
# ============================================================
# This script verifies the deployment status on Oracle Cloud
# Checks services, domains, and connectivity
# ============================================================

echo "======================================"
echo "🏝️ ARCHIPELAGO DEPLOYMENT VERIFICATION"
echo "======================================"
echo ""

# Configuration
ORACLE_IP="132.226.223.180"
SSH_KEY="C:\Users\marce\Documents\AI\useless\ssh\ssh-key-2025-04-13.key"
SSH_USER="opc"

echo "📍 Oracle Instance IP: $ORACLE_IP"
echo "🔑 SSH Key: $SSH_KEY"
echo ""

# Function to SSH and run command
ssh_cmd() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$ORACLE_IP" "$1" 2>/dev/null || echo "SSH command failed: $1"
}

# Check running processes
echo "🔍 CHECKING RUNNING PROCESSES:"
echo "================================"
ssh_cmd "ps aux | grep -E '(node|nginx|apache|express)' | grep -v grep"
echo ""

# Check server files
echo "📁 CHECKING SERVER FILES:"
echo "=========================="
ssh_cmd "ls -la /home/opc/archipelago/server/"
echo ""

# Check constants configuration
echo "⚙️ CHECKING CONFIGURATION:"
echo "==========================="
ssh_cmd "cat /home/opc/archipelago/server/constants.js" 2>/dev/null || echo "constants.js not found"
echo ""

# Check open ports
echo "🚪 CHECKING OPEN PORTS:"
echo "========================"
ssh_cmd "netstat -tlnp | head -15"
echo ""

# Test server startup
echo "🚀 TESTING SERVER STARTUP:"
echo "==========================="
ssh_cmd "cd /home/opc/archipelago/server && timeout 5s node server.js" 2>&1 || echo "Server startup failed"
echo ""

# Check if server is responding
echo "🏥 TESTING SERVER HEALTH:"
echo "=========================="
ssh_cmd "curl -s http://localhost:3001/health" 2>/dev/null || echo "Health check failed"
ssh_cmd "curl -s http://132.226.223.180:3001/health" 2>/dev/null || echo "Public IP health check failed"
echo ""

# Check nginx configuration
echo "🌐 CHECKING NGINX CONFIG:"
echo "=========================="
ssh_cmd "cat /etc/nginx/nginx.conf" 2>/dev/null | head -10 || echo "nginx.conf not found"
ssh_cmd "ls -la /etc/nginx/sites-enabled/" 2>/dev/null || echo "sites-enabled not found"
echo ""

# Check domain DNS (if dig is available)
echo "🔍 CHECKING DOMAIN RESOLUTION:"
echo "==============================="
ssh_cmd "dig archipelago.art +short" 2>/dev/null || echo "dig not available or domain not resolving"
ssh_cmd "dig islands.useless.com +short" 2>/dev/null || echo "dig not available or domain not resolving"
ssh_cmd "dig dare.uselsess.info +short" 2>/dev/null || echo "dig not available or domain not resolving"
ssh_cmd "nslookup archipelago.art" 2>/dev/null | head -5 || echo "nslookup not available"
echo ""

# Test public URLs
echo "🌍 TESTING PUBLIC URLS:"
echo "========================"
echo "Testing http://$ORACLE_IP:3001/health ..."
curl -s http://$ORACLE_IP:3001/health 2>/dev/null || echo "❌ Public URL not responding"
echo ""

echo "Testing https://archipelago.art (if configured)..."
curl -s -k https://archipelago.art 2>/dev/null || echo "❌ Domain URL not responding"
echo ""

echo "Testing http://$ORACLE_IP:80 (nginx)..."
curl -s http://$ORACLE_IP:80 2>/dev/null || echo "❌ nginx port 80 not responding"
echo ""

echo "Testing http://$ORACLE_IP:443 (nginx SSL)..."
curl -s -k https://$ORACLE_IP:443 2>/dev/null || echo "❌ nginx port 443 not responding"
echo ""

echo "======================================"
echo "✅ VERIFICATION COMPLETE"
echo "======================================"

echo ""
echo "NEXT STEPS:"
echo "1. Fix any JavaScript syntax errors in server.js"
echo "2. Ensure all npm dependencies are installed"
echo "3. Configure nginx for proper domain routing"
echo "4. Update DNS records to point to $ORACLE_IP"
echo "5. Test nginx reverse proxy configuration"
echo ""

echo "WORKING URLs (direct):"
echo "- http://$ORACLE_IP:3001/health     (if Archipelago server running)"
echo "- http://$ORACLE_IP:80              (if nginx configured)"
echo "- http://$ORACLE_IP:443             (if nginx SSL configured)"

echo ""
echo "CURRENT STATUS SUMMARY:"
echo -n "Archipelago server: "
ssh_cmd "ps aux | grep -c 'node.*server.js'" >/dev/null 2>&1 && echo "✅ RUNNING" || echo "❌ NOT RUNNING"

echo -n "nginx web server: "
ssh_cmd "ps aux | grep -c 'nginx.*worker'" >/dev/null 2>&1 && echo "✅ RUNNING" || echo "❌ NOT RUNNING"

echo -n "dare_app server: "
ssh_cmd "ps aux | grep -c 'dare_app'" >/dev/null 2>&1 && echo "✅ RUNNING" || echo "❌ NOT RUNNING"

echo ""
echo "❌ The user's NXDOMAIN errors are likely due to:"
echo "   - Archipelago Island API server not running"
echo "   - DNS records not pointing to $ORACLE_IP"
echo "   - nginx misconfiguration"
echo "   - Server.js syntax errors preventing startup"