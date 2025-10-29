# 🔧 Fix Koyeb Production Error

## ⚠️ Current Error
```
404 The model `gpt-4.5` does not exist or you do not have access to it.
```

## 🎯 Root Cause
Koyeb Dashboard มี environment variable `OPENAI_MODEL=gpt-4.5` ที่ผิด

**ไม่มี model ชื่อ `gpt-4.5`** - OpenAI models ที่มีจริง:
- ✅ `gpt-4o` (GPT-4 Omni - latest, recommended)
- ✅ `gpt-4o-mini` (GPT-4 Omni Mini - faster, cheaper)
- ✅ `gpt-4-turbo`
- ✅ `gpt-4`
- ✅ `gpt-3.5-turbo`

## 🚀 วิธีแก้ไข

### Option 1: แก้ใน Koyeb Dashboard (แนะนำ - ทันที)

1. ไปที่ Koyeb Dashboard: https://app.koyeb.com/
2. เลือก Service: `api-worker` (หรือชื่อที่คุณตั้ง)
3. ไปที่ **Settings** → **Environment Variables**
4. แก้ไข `OPENAI_MODEL`:
   ```
   เดิม: gpt-4.5
   ใหม่: gpt-4o-mini
   ```
   หรือ
   ```
   ใหม่: gpt-4o (แนะนำ - คุณภาพดีที่สุด)
   ```

5. กด **Save** และ **Redeploy**

### Option 2: ลบ Environment Variable ออก

1. ไปที่ Koyeb Dashboard
2. **ลบ** environment variable `OPENAI_MODEL` ออก
3. ระบบจะใช้ค่า default จาก `.koyeb/config.yaml` (`gpt-4o-mini`)

### Option 3: อัพเดทผ่าน Code

ถ้าคุณต้องการแก้ผ่าน config file:

1. แก้ไข `.koyeb/config.yaml`:
   ```yaml
   - name: OPENAI_MODEL
     value: gpt-4o-mini  # หรือ gpt-4o
   ```

2. Push code:
   ```bash
   git add .koyeb/config.yaml
   git commit -m "Fix: Update OpenAI model to gpt-4o-mini"
   git push origin main
   ```

3. Koyeb จะ auto-deploy

## 📊 Model Comparison

| Model | Speed | Cost | Quality | Recommended For |
|-------|-------|------|---------|----------------|
| `gpt-4o` | Fast | Medium | Best | Production (recommended) |
| `gpt-4o-mini` | Fastest | Cheapest | Good | Development, high-volume |
| `gpt-4-turbo` | Medium | High | Excellent | Complex tasks |
| `gpt-4` | Slow | Highest | Excellent | Maximum quality |

**แนะนำ:**
- **Development/Testing**: `gpt-4o-mini` (เร็ว, ถูก)
- **Production**: `gpt-4o` (balance ระหว่าง speed, cost, quality)

## ✅ ตรวจสอบการแก้ไข

### 1. Check Logs
```bash
# ตรวจสอบ logs ใน Koyeb
# ควรเห็น:
✅ OpenAI client initialized
✅ [AI] Content generated for Product Name

# ไม่ควรเห็น:
❌ 404 The model `gpt-4.5` does not exist
```

### 2. Test API
```bash
curl -X POST https://your-app.koyeb.app/api/ai/generate-content \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": ["your-product-id"]
  }'
```

ควรได้ response:
```json
{
  "success": true,
  "mode": "synchronous",
  "processed": 1,
  "results": [
    {
      "productId": "...",
      "content": {
        "caption": "...",
        "hashtags": [...]
      }
    }
  ]
}
```

## 🔍 Troubleshooting

### ยังเจอ error `gpt-4.5` อยู่
1. ตรวจสอบว่าได้ redeploy แล้ว
2. Clear Koyeb cache: Stop service → Start service
3. ตรวจสอบ environment variables ทั้งหมดใน Dashboard

### เจอ error อื่น
```
401 Unauthorized
→ เช็ค OPENAI_API_KEY ใน Koyeb Secrets

429 Rate limit exceeded
→ OpenAI API quota เต็ม, ต้องเติมเงินหรือรอ

500 Internal server error
→ เช็ค logs: koyeb logs -f
```

## 📝 Environment Variables ที่ต้องตั้งใน Koyeb

### Required (ต้องมี):
```bash
# Database
MONGODB_URI=mongodb://...

# AI - เลือกอย่างน้อง 1 อัน
OPENAI_API_KEY=sk-...
# หรือ
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional (ไม่ต้องก็ได้):
```bash
# AI Model (ถ้าไม่ใส่จะใช้ default)
OPENAI_MODEL=gpt-4o-mini  # default ถูกต้องแล้ว
AI_PROVIDER=openai  # default

# Queue (ถ้าไม่มี RabbitMQ จะใช้ synchronous mode)
RABBITMQ_URL=amqp://...

# Logging
LOG_LEVEL=info  # default
```

## 🎉 Expected Result

หลังแก้ไข ควรเห็น:
```
✅ AI content generation works
✅ No 404 model errors
✅ Products have generated content
```

---

**Priority:** 🔴 URGENT - Production is broken
**Fix Time:** ⚡ 2 minutes via Koyeb Dashboard
**Impact:** 🎯 AI generation will work immediately
