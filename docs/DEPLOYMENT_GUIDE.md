# HealthSync — Deployment Guide

**Version:** 1.0.0
**Date:** 19 July 2026
**Author:** Oyekunle Oyekola
**Classification:** Internal — Operations Team

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database Configuration](#3-database-configuration)
4. [Build and Deploy](#4-build-and-deploy)
5. [Reverse Proxy Configuration](#5-reverse-proxy-configuration)
6. [SSL/TLS Configuration](#6-ssltls-configuration)
7. [Post-Deployment Verification](#7-post-deployment-verification)
8. [Backup and Recovery](#8-backup-and-recovery)
9. [Monitoring and Logging](#9-monitoring-and-logging)
10. [Scaling Considerations](#10-scaling-considerations)
11. [Rollback Procedure](#11-rollback-procedure)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 100 GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.x LTS or 22.x | Runtime |
| npm | 10.x+ | Package manager |
| PostgreSQL | 15+ | Production database |
| Nginx | 1.24+ | Reverse proxy |
| Git | 2.40+ | Source control |
| OpenSSL | 3.x | TLS certificates |

### Network Requirements

- Port 443 (HTTPS) open to hospital network
- Port 5432 (PostgreSQL) internal only
- Port 3000 (Node.js) internal only — behind reverse proxy
- DNS record pointing to server IP

---

## 2. Environment Setup

### 2.1 Clone the Repository

```bash
git clone <repository-url> /opt/healthsync
cd /opt/healthsync
```

### 2.2 Install Dependencies

```bash
npm ci --production=false
```

### 2.3 Configure Environment Variables

Create `/opt/healthsync/.env`:

```env
# Database — PostgreSQL connection string
DATABASE_URL="postgresql://healthsync_user:STRONG_PASSWORD_HERE@localhost:5432/healthsync_db?schema=public"

# JWT Secret — MUST be at least 32 characters, cryptographically random
# Generate with: openssl rand -base64 48
JWT_SECRET="REPLACE_WITH_CRYPTOGRAPHICALLY_RANDOM_SECRET_MIN_32_CHARS"

# Runtime
NODE_ENV="production"
PORT=3000
```

**CRITICAL:** The JWT_SECRET must be:
- At least 32 characters long
- Cryptographically random (use `openssl rand -base64 48`)
- Not contain the string "dev-secret" (enforced at startup)
- Unique per environment (do not reuse between staging and production)

### 2.4 Secure the .env File

```bash
chmod 600 /opt/healthsync/.env
chown healthsync:healthsync /opt/healthsync/.env
```

---

## 3. Database Configuration

### 3.1 Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install postgresql-15

# Start and enable
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3.2 Create Database and User

```bash
sudo -u postgres psql <<SQL
CREATE USER healthsync_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE healthsync_db OWNER healthsync_user;
GRANT ALL PRIVILEGES ON DATABASE healthsync_db TO healthsync_user;
SQL
```

### 3.3 Migrate from SQLite to PostgreSQL

Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
}
```

Run migrations:

```bash
npx prisma migrate deploy
```

### 3.4 Seed Initial Data

```bash
npx prisma db seed
```

This creates the default admin account. **Change the admin password immediately after first login.**

### 3.5 PostgreSQL Security Hardening

Edit `pg_hba.conf`:

```
# Reject all remote connections except from the app server
host healthsync_db healthsync_user 127.0.0.1/32 scram-sha-256
host all all 0.0.0.0/0 reject
```

Edit `postgresql.conf`:

```
listen_addresses = 'localhost'
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
log_connections = on
log_disconnections = on
log_statement = 'mod'
```

---

## 4. Build and Deploy

### 4.1 Build the Application

```bash
cd /opt/healthsync
npm run build
```

Verify the build succeeds with no errors.

### 4.2 Create a System Service

Create `/etc/systemd/system/healthsync.service`:

```ini
[Unit]
Description=HealthSync Hospital Management System
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=healthsync
Group=healthsync
WorkingDirectory=/opt/healthsync
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/healthsync/.env

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/healthsync
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

### 4.3 Start the Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable healthsync
sudo systemctl start healthsync

# Verify it's running
sudo systemctl status healthsync
curl -s http://localhost:3000 | head -5
```

---

## 5. Reverse Proxy Configuration

### 5.1 Nginx Configuration

Create `/etc/nginx/sites-available/healthsync`:

```nginx
upstream healthsync_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name healthsync.hospital.local;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name healthsync.hospital.local;

    # SSL certificates
    ssl_certificate     /etc/ssl/certs/healthsync.crt;
    ssl_certificate_key /etc/ssl/private/healthsync.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5:!3DES;
    ssl_prefer_server_ciphers on;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers (supplementing application-level middleware)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Request limits
    client_max_body_size 10M;
    client_body_timeout 30s;
    client_header_timeout 30s;

    # Rate limiting zone (defined in nginx.conf http block)
    # limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    location / {
        proxy_pass http://healthsync_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # Static assets — long cache
    location /_next/static/ {
        proxy_pass http://healthsync_backend;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://healthsync_backend;
        access_log off;
    }

    # Block direct access to sensitive paths
    location ~ /\. {
        deny all;
    }
}
```

### 5.2 Enable and Test

```bash
sudo ln -s /etc/nginx/sites-available/healthsync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. SSL/TLS Configuration

### 6.1 For Internal Hospital Network (Self-Signed)

```bash
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/ssl/private/healthsync.key \
  -out /etc/ssl/certs/healthsync.crt \
  -subj "/C=NG/ST=Lagos/O=Hospital/CN=healthsync.hospital.local"
```

### 6.2 For Public-Facing (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d healthsync.hospital.com
sudo certbot renew --dry-run
```

---

## 7. Post-Deployment Verification

### 7.1 Verification Checklist

Run in order after deployment:

```bash
# 1. Application starts without errors
sudo systemctl status healthsync

# 2. Database connectivity
curl -s https://healthsync.hospital.local/login | grep -q "Sign in" && echo "PASS" || echo "FAIL"

# 3. Run acceptance tests
cd /opt/healthsync && npx tsx scripts/verify.ts

# 4. Check security headers
curl -sI https://healthsync.hospital.local/ | grep -E "(X-Content-Type|X-Frame|Strict-Transport|Content-Security)"

# 5. Verify HTTPS redirect
curl -sI http://healthsync.hospital.local/ | grep "301"

# 6. Test login with admin account
# (manual — log in via browser and verify dashboard loads)

# 7. Verify JWT secret is production-grade
# The application will refuse to start if JWT_SECRET is weak in production mode
```

### 7.2 Smoke Tests

| Test | Expected Result | Pass/Fail |
|------|----------------|-----------|
| Login page loads | 200 OK with sign-in form | |
| Admin login works | Redirect to /dashboard | |
| Patient registration | MRN generated, audit logged | |
| Appointment booking | No double-booking allowed | |
| Patient portal | Scoped to logged-in patient | |
| Nurse cannot prescribe | 403 error returned | |
| Audit log visible to admin only | Other roles see 403 | |

---

## 8. Backup and Recovery

### 8.1 Automated Database Backups

Create `/opt/healthsync/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/healthsync"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

pg_dump -U healthsync_user -h localhost healthsync_db \
  | gzip > "$BACKUP_DIR/healthsync_$TIMESTAMP.sql.gz"

# Encrypt backup (PHI protection)
gpg --symmetric --batch --passphrase-file /opt/healthsync/.backup-key \
  "$BACKUP_DIR/healthsync_$TIMESTAMP.sql.gz"
rm "$BACKUP_DIR/healthsync_$TIMESTAMP.sql.gz"

# Rotate old backups
find "$BACKUP_DIR" -name "*.gpg" -mtime +$RETENTION_DAYS -delete

echo "$(date): Backup completed — healthsync_$TIMESTAMP.sql.gz.gpg" >> /var/log/healthsync-backup.log
```

Add to crontab:

```cron
0 2 * * * /opt/healthsync/scripts/backup.sh
```

### 8.2 Recovery Procedure

```bash
# Decrypt backup
gpg --decrypt "$BACKUP_DIR/healthsync_YYYYMMDD_HHMMSS.sql.gz.gpg" \
  | gunzip | psql -U healthsync_user -h localhost healthsync_db
```

---

## 9. Monitoring and Logging

### 9.1 Application Logs

```bash
# View live logs
sudo journalctl -u healthsync -f

# View errors only
sudo journalctl -u healthsync -p err
```

### 9.2 Log Rotation

Create `/etc/logrotate.d/healthsync`:

```
/var/log/healthsync/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
}
```

### 9.3 Health Monitoring

Add a health check API route and monitor with your preferred tool (Uptime Kuma, Nagios, etc.):

```bash
# Simple uptime check
curl -sf https://healthsync.hospital.local/login > /dev/null || alert "HealthSync DOWN"
```

---

## 10. Scaling Considerations

### 10.1 Horizontal Scaling

HealthSync runs stateless (JWT sessions, no server-side session store). To scale:

1. Deploy multiple Node.js instances behind a load balancer
2. All instances share the same PostgreSQL database
3. Ensure `JWT_SECRET` is identical across instances
4. Use sticky sessions or ensure cookies reach any instance

### 10.2 Database Scaling

- Add read replicas for dashboard/reporting queries
- Consider connection pooling via PgBouncer for >50 concurrent users
- Enable PostgreSQL `pg_stat_statements` for slow query monitoring

---

## 11. Rollback Procedure

```bash
# 1. Stop the service
sudo systemctl stop healthsync

# 2. Restore previous version
cd /opt/healthsync
git checkout <previous-release-tag>
npm ci --production=false
npm run build

# 3. Rollback database (if migration was applied)
npx prisma migrate resolve --rolled-back <migration-name>

# 4. Restart
sudo systemctl start healthsync

# 5. Verify
curl -s https://healthsync.hospital.local/login | grep -q "Sign in"
```

---

## 12. Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| "JWT_SECRET is not set" on startup | Missing .env or variable | Verify `.env` exists and is readable by the service user |
| "JWT_SECRET must be at least 32 characters" | Weak secret in production | Generate a proper secret: `openssl rand -base64 48` |
| 502 Bad Gateway | Node.js crashed | Check `journalctl -u healthsync` for errors |
| Database connection refused | PostgreSQL not running or wrong URL | Verify `DATABASE_URL` and PostgreSQL status |
| "EACCES" permission errors | Wrong file ownership | Run `chown -R healthsync:healthsync /opt/healthsync` |
| Slow page loads | Database not indexed | Run `ANALYZE` on PostgreSQL tables |
| Login fails for all users | JWT secret changed | All sessions are invalidated; users must re-login (expected) |

---

*End of Deployment Guide*
