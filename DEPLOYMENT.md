# Deployment Guide

## 🚀 Quick Deploy to Production

### Latest Fix: AI Generation without RabbitMQ
**Commit:** `713ad38` - Adds synchronous fallback when RabbitMQ is unavailable

### Deployment Steps

#### 1. Push to Repository
```bash
git push origin main
```

#### 2. Deploy to Production Server

**Option A: Pull and Restart (Recommended)**
```bash
# SSH to production server
ssh your-production-server

# Navigate to project directory
cd /path/to/shp-vid-aff-be

# Pull latest changes
git pull origin main

# Install dependencies (if needed)
bun install

# Restart the application
# If using PM2:
pm2 restart all

# If using Docker:
docker-compose --profile production up -d --build

# If using systemd:
sudo systemctl restart shopee-backend
```

**Option B: Redeploy Container**
```bash
# On production server with Docker
docker-compose down
docker-compose --profile production up -d --build
```

#### 3. Verify Deployment
```bash
# Check logs
docker-compose logs -f backend

# Or if using PM2
pm2 logs

# Test the API
curl http://your-server:3000/health
```

## 📋 What This Fix Does

### Before (Production Error):
```
❌ [AI] Queue system not available - RabbitMQ not connected
→ Returns error, AI generation fails
```

### After (Production Working):
```
⚠️  [AI] Queue system not available - Using synchronous processing
✅ [AI] Content generated for Product Name
→ Returns success with generated content
```

## 🔄 How It Works

### With RabbitMQ (Queue Mode):
- Fast response (job queued)
- Background processing
- Scalable for many requests

### Without RabbitMQ (Synchronous Mode - FALLBACK):
- Slower response (waits for AI)
- Immediate processing
- Works without queue infrastructure

## 🎯 Production Recommendations

### Option 1: Use Synchronous Mode (Current)
✅ **Pros:**
- No additional infrastructure needed
- Simple deployment
- Works immediately

❌ **Cons:**
- Slower API responses (waits for AI API)
- No retry mechanism
- Limited concurrent requests

**Use when:** Small scale, testing, or RabbitMQ unavailable

### Option 2: Enable RabbitMQ (Recommended)
✅ **Pros:**
- Fast API responses
- Background processing
- Automatic retries
- Handles high load

❌ **Cons:**
- Requires RabbitMQ service
- More infrastructure

**Use when:** Production with high traffic

#### To Enable RabbitMQ:

**Local RabbitMQ:**
```bash
docker-compose up -d rabbitmq
```

**External RabbitMQ (e.g., CloudAMQP, Koyeb):**
Update `.env`:
```bash
RABBITMQ_URL=amqp://user:pass@your-rabbitmq-host:5672
```

Then restart:
```bash
docker-compose restart backend
# or
pm2 restart all
```

## 🔍 Monitoring

### Check if RabbitMQ is connected:
```bash
curl http://your-server:3000/health
```

Response will show:
```json
{
  "status": "ok",
  "services": {
    "rabbitmq": true,  // ✅ Queue mode active
    "mongodb": true
  }
}
```

Or:
```json
{
  "status": "ok",
  "services": {
    "rabbitmq": false,  // ⚠️  Synchronous mode
    "mongodb": true
  },
  "warnings": ["RabbitMQ is not available - Queue features disabled"]
}
```

### Check AI generation response:
**Queue Mode:**
```json
{
  "success": true,
  "queued": 1,
  "estimatedTime": "10s"
}
```

**Synchronous Mode:**
```json
{
  "success": true,
  "mode": "synchronous",
  "processed": 1,
  "message": "Content generated synchronously (Queue unavailable)"
}
```

## 🐛 Troubleshooting

### AI Generation Still Fails
1. Check API keys in `.env`:
   ```bash
   OPENAI_API_KEY=sk-...
   # or
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Check logs:
   ```bash
   docker-compose logs -f
   # or
   pm2 logs
   ```

### Performance Issues (Synchronous Mode)
- Consider enabling RabbitMQ
- Reduce concurrent AI generation requests
- Use queue mode for batch operations

## 📝 Environment Variables

Required in production:
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/shopee-video-gen
REDIS_URL=redis://localhost:6379

# AI (at least one required)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=openai

# Optional: Queue (for better performance)
RABBITMQ_URL=amqp://localhost:5672

# Server
PORT=3000
NODE_ENV=production
```

## 🎉 Success Indicators

After deployment, you should see:
```
✅ Backend API Server is running
✅ AI content generation works (either mode)
✅ No crashes when RabbitMQ unavailable
```

Check with:
```bash
curl -X POST http://your-server:3000/api/ai/generate-content \
  -H "Content-Type: application/json" \
  -d '{"productIds": ["your-product-id"]}'
```

Should return either:
- `"mode": "synchronous"` (without RabbitMQ) ✅
- `"queued": 1` (with RabbitMQ) ✅

NOT:
- `"error": "Queue system is not available"` ❌

---

**Last Updated:** 2025-10-28
**Latest Commit:** `713ad38` - Synchronous fallback for AI generation
