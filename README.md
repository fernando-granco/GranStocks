# GranStocks Analytics
A deterministic stock analysis web application built for cheap VPS deployments. 
Includes strict Finnhub rate limiting caching and optional Bring-Your-Own-Key (BYOK) AI narrative generation.

## Monorepo Structure
- `/server`: Fastify + Prisma (SQLite) backend.
- `/client`: React + Vite + Tailwind frontend.

## 💻 Local Development

Running the application locally is the best way to debug and develop new features, as it offers instant hot-reloading and direct console access.

1. Ensure your `.env` file is completely filled out in the `/server` directory (see Initial Setup below).
2. Open two separate terminal windows dynamically at the root of the project (`/granstocks`).

**Terminal 1 (Backend Server):**
```bash
npm run dev:server
```
*This starts the Fastify backend on `http://localhost:3000` with hot-reloading powered by `tsx`.*

**Terminal 2 (Frontend Client):**
```bash
npm run dev:client
```
*This starts the Vite React frontend on `http://localhost:5173` with Hot Module Replacement (HMR).*

Open `http://localhost:5173` in your browser to view the app. The client is explicitly configured to proxy `/api` requests to the local server running on port 3000.

## 🚀 VPS Deployment Instructions

### 1. Installation

This project is a **NPM workspace monorepo**, meaning you run installation commands at the root folder `GranStocks/` to install dependencies for both the `/server` and `/client` directories simultaneously.

1. Clone this repository to `/var/www/granstocks` on your VPS.
2. Enter the root `granstocks` folder and generate the client and server builds:
```bash
cd /var/www/granstocks
npm install
npm run build
```

### 2. Configure Environment Variables
Enter the `server` folder, copy `.env.example` to `.env` and configure your API keys.

```bash
cd /var/www/granstocks/server
cp .env.example .env
nano .env
```

**Understanding the Variables:**
- `FINNHUB_API_KEY`: Get this for free from [Finnhub.io](https://finnhub.io/).
- `APP_ORIGIN`: Your deployment URL (e.g. `https://granstocks.yourdomain.com`). Used for CORS security.
- `ENCRYPTION_MASTER_KEY`: **MUST BE EXACTLY 32 CHARACTERS (bytes) LONG**. This key is used to AES-256 encrypt your personal AI provider keys in the SQLite database. If lost, connected AI accounts will fail to decrypt.
- `ADMIN_JOB_TOKEN`: A secret password of your choosing (e.g. `my_secure_cron_password_123`). This protects the `/api/admin/run-daily` endpoint so random people can't trigger the heavy cron job manually.

### 3. Database Initialization
Once your `.env` is saved, initialize SQLite from inside the `server/` directory:
```bash
npx prisma migrate dev --name init
```

### 4. Running as a Service (systemd)
Copy the included `granstocks-server.service` to `/etc/systemd/system/`.
```bash
sudo cp granstocks-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable granstocks-server
sudo systemctl start granstocks-server
```

### 5. Nginx Reverse Proxy
To make GranStocks accessible over the internet securely, install Nginx and Certbot (for free SSL certificates), apply the proxy config, and start it.

**Ubuntu/Debian Installation:**
```bash
sudo apt update
sudo apt install nginx python3-certbot-nginx -y
```

**Apply the Configuration:**
1. Copy the proxy snippet into your Nginx available sites list:
```bash
sudo cp granstocks-nginx.conf /etc/nginx/sites-available/granstocks
```
2. Enable the site by symlinking it:
```bash
sudo ln -s /etc/nginx/sites-available/granstocks /etc/nginx/sites-enabled/
```
3. Test your Nginx syntax and restart the service:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Acquire an SSL Certificate (HTTPS):**
Run the following command, follow the prompts, and let it modify your Nginx config automatically to support HTTPS.
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## Security Architecture Guarantee
1. **Frontend Isolation**: The React bundle has a strict build-step `audit-bundle.js` script that prevents CI builds if strings like `sk-` or `api.openai` are compiled into the client.
2. **BYOK Encryption**: User AI Keys are converted to AES-256-GCM encrypted formats inside `LLMConfig` tables.
3. **API Rate Limiting**: The backend employs a token-bucket wrapper limiting outbound 60/min Finnhub limits safely to an imposed 55/minute.
