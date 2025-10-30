# 🚀 Koyeb Deployment Guide - Quick Fix

## 🔴 Problem: Instance Stops Immediately

```
Instance created. Preparing to start...
Starting download...
Download progress: 100%
Instance is stopping.  ← Application crashed!
Instance stopped.
```

## ✅ Solution: Set Required Environment Variables

### Step 1: Push Latest Code First
```bash
git push origin main
```

Latest commit `3bfa2da` includes important fixes:
- Fixed CORS configuration error
- Better MongoDB error handling
- Improved logging

### Step 2: Set Environment Variables in Koyeb Dashboard

1. Go to https://app.koyeb.com/
2. Select your service: **api-worker**
3. Go to **Settings** → **Environment Variables**
4. Add the following **required** variables:

#### Required Variables:

**MONGODB_URI** (Secret recommended)
```
mongodb+srv://username:password@cluster.mongodb.net/shopee-video-gen
```
Or use MongoDB Atlas, Railway, or any MongoDB host.

**OPENAI_API_KEY** (Secret - REQUIRED)
```
sk-proj-...
```
Get from: https://platform.openai.com/api-keys

#### Optional but Recommended:

If you have the wrong model name, fix it:
```
OPENAI_MODEL = gpt-4o-mini
```
(Delete if it shows `gpt-4.5`)

### Step 3: Remove or Fix Invalid Variables

Check and fix these if they exist:

❌ **Remove** these if set:
- `RABBITMQ_URL` (unless you have external RabbitMQ)
- `REDIS_URL` (not needed without RabbitMQ)

❌ **Fix** if wrong:
- `OPENAI_MODEL` should be `gpt-4o-mini` NOT `gpt-4.5`

### Step 4: Save and Redeploy

1. Click **Save**
2. Koyeb will automatically redeploy
3. Watch the deployment logs

## 📊 Minimum Required Configuration

For basic deployment, you only need:

```bash
# Required
MONGODB_URI=mongodb+srv://...
OPENAI_API_KEY=sk-proj-...

# Already set in code (don't need to add)
NODE_ENV=production
PORT=3000
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
```

## 🔍 How to Check Deployment Logs

In Koyeb:
1. Go to your service
2. Click **Logs** tab
3. Look for:

✅ **Good logs:**
```
Connecting to MongoDB...
MongoDB URI: mongodb+srv://***:***@...
✅ MongoDB connected successfully
🚀 Backend API Server is running!
```

❌ **Bad logs (missing env):**
```
❌ MongoDB connection failed: MongooseError
Please check:
  1. MONGODB_URI environment variable is set correctly
  2. MongoDB server is accessible
```

## 🎯 Quick Checklist

- [ ] Push latest code (`git push origin main`)
- [ ] Set `MONGODB_URI` in Koyeb secrets
- [ ] Set `OPENAI_API_KEY` in Koyeb secrets
- [ ] Remove or fix `OPENAI_MODEL` (should be `gpt-4o-mini`)
- [ ] Remove `RABBITMQ_URL` if not using external RabbitMQ
- [ ] Save and wait for redeploy
- [ ] Check logs for successful startup

## 🆘 Still Not Working?

### MongoDB Connection Error
```
❌ MongoDB connection failed
```

**Solutions:**
1. Check MongoDB URI format:
   ```
   mongodb+srv://username:password@host/database
   ```
2. Whitelist Koyeb IP in MongoDB Atlas:
   - Network Access → Add IP: `0.0.0.0/0` (allow all)
3. Check username/password are correct
4. Ensure database name exists

### OpenAI API Error
```
401 Unauthorized
```

**Solutions:**
1. Check API key is valid: https://platform.openai.com/api-keys
2. Check you have credits in OpenAI account
3. Ensure API key starts with `sk-proj-` or `sk-`

### Port Binding Error
```
Error: listen EADDRINUSE
```

**Solution:** Already fixed in latest code. Make sure you pushed.

## 🎉 Success Indicators

After deployment, you should see:

```
✅ MongoDB connected successfully
✅ OpenAI client initialized
🚀 Backend API Server is running!

📍 Environment: Production
🌐 API: http://0.0.0.0:3000/api
📚 Swagger: http://localhost:3000/swagger
❤️  Health: http://localhost:3000/health
```

Test your deployment:
```bash
curl https://your-app.koyeb.app/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": {...},
  "services": {
    "rabbitmq": false,
    "mongodb": true
  }
}
```

## 📝 Working Configuration Example

**Environment Variables in Koyeb:**

```yaml
# Set as Secrets
MONGODB_URI: mongodb+srv://user:pass@cluster.mongodb.net/db
OPENAI_API_KEY: sk-proj-xxxxxxxxxxxxx

# Set as Environment Variables (or use defaults from code)
NODE_ENV: production
PORT: 3000
AI_PROVIDER: openai
OPENAI_MODEL: gpt-4o-mini
LOG_LEVEL: info
```

**That's it!** No need for Redis, RabbitMQ, or other complex setup.

The app will:
- ✅ Connect to MongoDB
- ✅ Use OpenAI for AI generation (synchronous mode)
- ✅ Handle uploads and products
- ✅ Generate content without queues

---

**Last Updated:** 2025-10-28
**Fixed Commit:** `3bfa2da` - Koyeb deployment fixes
**Priority:** 🔴 CRITICAL - Production down
