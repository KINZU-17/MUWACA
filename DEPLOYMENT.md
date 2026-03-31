# MUWACA Water Billing System - Deployment Guide

## 🚀 Deployment Options

### Option 1: Local Development Deployment

#### Prerequisites
- Node.js 14+ installed
- npm installed

#### Steps
```bash
# 1. Navigate to project directory
cd muwaca

# 2. Install dependencies
npm install

# 3. Start the backend server
npm start
# Server will run on http://localhost:3000

# 4. In a new terminal, serve the frontend
python3 -m http.server 8000
# Frontend will run on http://localhost:8000

# 5. Open browser and navigate to http://localhost:8000
```

#### Default Login Credentials
- **Admin**: username: `admin`, password: `password123`
- **Customer Portal**: Use customer phone number (any PIN for demo)

---

### Option 2: Docker Deployment (Recommended for Production)

#### Prerequisites
- Docker installed
- Docker Compose installed

#### Steps
```bash
# 1. Navigate to project directory
cd muwaca

# 2. Create environment file (optional)
cp .env.example .env
# Edit .env with your configuration

# 3. Build and run with Docker Compose
docker-compose up -d

# 4. Check status
docker-compose ps

# 5. View logs
docker-compose logs -f muwaca-app

# 6. Access application
# Frontend: http://localhost
# Backend API: http://localhost:3000
```

#### Docker Commands
```bash
# Stop application
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# View running containers
docker ps

# Access container shell
docker exec -it muwaca-water-billing sh

# Backup database
docker cp muwaca-water-billing:/app/muwaca.db ./backup.db
```

---

### Option 3: Cloud Deployment (AWS/DigitalOcean/VPS)

#### Prerequisites
- Cloud server (Ubuntu 20.04+ recommended)
- Domain name (optional)
- SSH access

#### Steps

##### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker (optional)
sudo apt install docker.io docker-compose -y

# Install Nginx (optional)
sudo apt install nginx -y
```

##### 2. Deploy Application
```bash
# Clone or upload project
git clone <your-repository-url>
cd muwaca

# Install dependencies
npm install

# Create systemd service (optional)
sudo nano /etc/systemd/system/muwaca.service
```

##### 3. Create Systemd Service
```ini
[Unit]
Description=MUWACA Water Billing System
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/muwaca
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

##### 4. Start Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable muwaca

# Start service
sudo systemctl start muwaca

# Check status
sudo systemctl status muwaca

# View logs
sudo journalctl -u muwaca -f
```

##### 5. Configure Nginx (Optional)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

##### 6. Enable HTTPS (Optional)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

### Option 4: Heroku Deployment

#### Prerequisites
- Heroku account
- Heroku CLI installed

#### Steps
```bash
# 1. Login to Heroku
heroku login

# 2. Create Heroku app
heroku create muwaca-water-billing

# 3. Add buildpack
heroku buildpacks:set heroku/nodejs

# 4. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key

# 5. Deploy
git push heroku main

# 6. Open application
heroku open
```

---

## 🔧 Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secret-key-here

# M-Pesa Configuration
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
MPESA_ENVIRONMENT=sandbox

# SMS Configuration (Africa's Talking)
SMS_API_KEY=your_sms_api_key
SMS_USERNAME=your_sms_username
SMS_SENDER_ID=MUWACA

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
EMAIL_FROM=MUWACA Water <noreply@muwaca.com>
```

---

## 📊 Database Backup & Restore

### Backup
```bash
# Local backup
cp muwaca.db muwaca_backup_$(date +%Y%m%d).db

# Docker backup
docker cp muwaca-water-billing:/app/muwaca.db ./backup_$(date +%Y%m%d).db

# API backup (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/backup -o backup.db
```

### Restore
```bash
# Local restore
cp backup.db muwaca.db

# Docker restore
docker cp backup.db muwaca-water-billing:/app/muwaca.db
docker-compose restart muwaca-app

# API restore (requires authentication)
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -F "backup=@backup.db" http://localhost:3000/api/restore
```

---

## 🔒 Security Checklist

- [ ] Change default admin password
- [ ] Set strong JWT_SECRET
- [ ] Configure M-Pesa credentials
- [ ] Set up SSL/HTTPS
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up regular backups
- [ ] Monitor application logs
- [ ] Keep dependencies updated

---

## 📞 Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Ensure all dependencies are installed
4. Check database connectivity
5. Verify port availability

---

## 🎯 Quick Start Commands

```bash
# Development
npm install && npm start

# Docker
docker-compose up -d

# Production
npm install --production
NODE_ENV=production node server.js
```
