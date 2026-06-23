# Deploying to Fly.io

## Step 1: Install Fly.io CLI

```bash
curl -L https://fly.io/install.sh | sh
```

On macOS with Homebrew:
```bash
brew install flyctl
```

## Step 2: Sign Up & Login

```bash
flyctl auth signup
# OR if you already have an account:
flyctl auth login
```

## Step 3: Deploy the Backend

Navigate to your backend directory:
```bash
cd /home/huzeir/Documents/dev-stuff/react-native/ctpat-inspection-app/ctpat-backend
```

Deploy with Fly.io:
```bash
flyctl launch
```

When prompted:
- **App Name**: `ctpat-inspection-api` (or your choice)
- **Region**: Select closest to you (e.g., `iad` for US East)
- **Database**: Choose `No` (we're using MongoDB Atlas)
- **Modify Configuration**: Choose `No` (we have `fly.toml`)

## Step 4: Set Environment Variables

After deployment, set your environment variables:

```bash
flyctl secrets set \
  NODE_ENV=production \
  MONGODB_URI="mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@your-cluster.mongodb.net/ctpat-inspections" \
  CORS_ORIGIN="https://yourdomain.com" \
  EMAIL_PROVIDER=smtp \
  SMTP_HOST=smtp.gmail.com \
  SMTP_PORT=587 \
  SMTP_USER=camilkurpejovic@gmail.com \
  SMTP_PASSWORD="your-gmail-app-password" \
  EMAIL_FROM=camilkurpejovic@gmail.com \
  EMAIL_RECIPIENT=ctpat@landstar.com \
  SUPABASE_URL="your-supabase-url" \
  SUPABASE_ANON_KEY="your-supabase-key" \
  JWT_SECRET="your-jwt-secret"
```

Or set them individually:
```bash
flyctl secrets set MONGODB_URI="mongodb+srv://..."
flyctl secrets set EMAIL_PROVIDER=smtp
# etc...
```

## Step 5: Verify Deployment

Check your app status:
```bash
flyctl status
```

View logs:
```bash
flyctl logs
```

Test the API:
```bash
curl https://ctpat-inspection-api.fly.dev/health
```

## Step 6: Get Your API URL

Your backend will be available at:
```
https://ctpat-inspection-api.fly.dev
```

(Replace `ctpat-inspection-api` with your actual app name)

## Step 7: Update Frontend

Update your frontend API endpoint in `PdfService.ts`:

```typescript
const API_BASE_URL = 'https://ctpat-inspection-api.fly.dev';
```

Then rebuild and redeploy the Android APK.

## Monitoring & Maintenance

### View App Status
```bash
flyctl status
```

### View Logs
```bash
flyctl logs
```

### Restart App
```bash
flyctl restart
```

### Scale Up (if needed)
```bash
flyctl scale count 2
```

## Troubleshooting

### Check if app is running
```bash
flyctl status
```

### View recent logs
```bash
flyctl logs --lines 100
```

### Redeploy after changes
```bash
flyctl deploy
```

### Check environment variables
```bash
flyctl secrets list
```

## Free Tier Limits

- Up to 3 shared-cpu-1x 256MB VMs
- 3GB persistent storage
- 160GB outbound data transfer/month
- Perfect for your use case!

