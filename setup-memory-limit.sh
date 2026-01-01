#!/bin/bash
# Setup memory limit for user sessions (80% of total RAM)
# Run with: sudo ./setup-memory-limit.sh

set -e

echo "Creating systemd user slice memory limit..."

mkdir -p /etc/systemd/system/user-.slice.d

cat > /etc/systemd/system/user-.slice.d/50-memory.conf << 'EOF'
[Slice]
MemoryMax=80%
MemoryHigh=70%
EOF

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Done! Memory limits configured:"
echo "  - MemoryMax: 80% (hard limit, processes killed if exceeded)"
echo "  - MemoryHigh: 70% (soft limit, throttling starts)"
echo ""
echo "IMPORTANT: You must LOG OUT and LOG BACK IN for limits to apply."
echo ""
echo "To verify after re-login, run:"
echo "  systemctl show user-\$(id -u).slice | grep -E 'Memory(Max|High)'"
