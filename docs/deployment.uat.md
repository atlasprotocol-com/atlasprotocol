# UAT Environment Deployment Guide

## Application Deployment

### 1. SSH Server & Key Generation

1. SSH into the server:

   ```bash
   ssh username@server-ip
   ```

2. Generate an SSH key pair:

   ```bash
   ssh-keygen -t rsa -b 4096 -C "uat-deployment" -f ~/.ssh/uat_id_rsa
   ```

   3. Copy the public key:

   ```bash
   cat ~/.ssh/uat_id_rsa.pub
   ```

3. Add the copied key to GitHub (Settings > Deploy Keys > Add Key). Enable "Allow Write Access" if needed.

### 2. Clone the Repository & Pull Latest Code

1. Ensure the `Projects` directory exists:

   ```bash
   mkdir -p ~/Projects
   ```

2. Navigate to the `Projects` directory:

   ```bash
   cd ~/Projects
   ```

3. Clone the repository:

   ```bash
   git clone git@github.com:atlasprotocol-com/atlasprotocol.git
   ```

4. Navigate into the project directory:

   ```bash
   cd atlasprotocol
   ```

5. [Optional] Checkout the branch you want to deploy

   ```bash
   git checkout develop
   ```

### 3. Install Dependencies

⚠️ **Ensure you configure `.env.local` correctly before proceeding!**
Refer to the project's documentation or `.env.example` for required variables.

1. Install Node.js (version 20) and npm:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. Install dependencies for both frontend and backend:

   ```bash
   cd frontend
   npm install
   cd ../backend
   npm install
   ```

### 4. Install and Configure PM2

1. Install PM2 globally:

   ```bash
   npm install -g pm2
   ```

2. Generate an ecosystem configuration file:

   ```bash
   pm2 init simple
   ```

3. Modify `ecosystem.config.js` to include both frontend and backend applications. Example:

   ```js
   module.exports = {
     apps: [
       {
         name: "frontend",
         script: "npm",
         args: "start",
         cwd: "./frontend",
         env: {
           NODE_ENV: "uat",
         },
       },
       {
         name: "backend",
         script: "npm",
         args: "run start",
         cwd: "./backend",
         env: {
           NODE_ENV: "uat",
         },
       },
     ],
   };
   ```

4. Start the applications:

   ```bash
   pm2 start ecosystem.config.js
   ```

5. Restart the applications if needed:

   ```bash
   pm2 restart ecosystem.config.js
   ```

6. Save the PM2 process list to auto-restart on reboot:

   ```bash
   pm2 save
   pm2 startup
   ```

## Reverse Proxy Configuration (Nginx)

### 1. Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### 2. Define Domain and Configuration

1. Create a new Nginx configuration file:

   ```bash
   sudo nano /etc/nginx/sites-available/uat
   ```

2. Add the following configuration:

   ```nginx
   server {
       listen 80;
       server_name uat.atlasprotocol.com;
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   server {
       listen 80;
       server_name api-uat.atlasprotocol.com;
       location / {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

3. Enable the configuration:

   ```bash
   sudo ln -s /etc/nginx/sites-available/uat /etc/nginx/sites-enabled/

   # Verify configuration
   sudo nginx -t

   # Expected output:
   # nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
   # nginx: configuration file /etc/nginx/nginx.conf test is successful

   # Restart Nginx to apply changes
   sudo systemctl restart nginx
   ```

### 3. Point Domain to Server IP

1. Update DNS records:

   - Add an `A` record for `uat.atlasprotocol.com` pointing to the server's IP.
   - Add an `A` record for `api-uat.atlasprotocol.com` pointing to the server's IP.

2. Verify with:

   ```bash
   nslookup uat.atlasprotocol.com
   ```

### 4. Set Up SSL with Certbot

1. Install Certbot:

   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. Run Certbot for SSL certificates:

   ```bash
   sudo certbot --nginx -d api-uat.atlasprotocol.com -d uat.atlasprotocol.com
   ```

3. Verify auto-renewal:

   ```bash
   sudo certbot renew --dry-run
   ```

## Security Hardening

### 1. Enable Firewall (UFW)

```bash
sudo apt install ufw -y
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

### 2. Allow Only Trusted SSH Connections

⚠️ **Warning:** Setting up trusted SSH IPs may block your current access. Ensure you add your own IP before proceeding.

1. Allow SSH from a specific trusted IP:
   ```bash
   sudo ufw allow from <trusted-ip> to any port 22
   ```
2. Enable the firewall:
   ```bash
   sudo ufw enable
   ```

### 3. Allow Only Necessary Public Ports

```bash
sudo ufw allow 80
sudo ufw allow 443
```

### 4. Verify Firewall Status

```bash
sudo ufw status
```

## Final Verification

1. Check running processes:

   ```bash
   pm2 list
   ```

2. Verify Nginx status:

   ```bash
   sudo systemctl status nginx
   ```

3. Confirm HTTPS is working:

   ```bash
   curl -I https://uat.atlasprotocol.com
   ```

Your UAT environment is now successfully deployed! 🚀
