# Shopee Video Generator - Backend API & Worker

Backend API และ Worker service สำหรับระบบสร้าง Video Affiliate Marketing อัตโนมัติสำหรับ Shopee

## 🏗️ Tech Stack

- **Runtime**: Bun v1.3+
- **Framework**: Elysia.js (Fast web framework for Bun)
- **Database**: MongoDB + Mongoose
- **Queue**: RabbitMQ + amqplib
- **AI**: OpenAI GPT-4o-mini / Anthropic Claude
- **Video**: FFmpeg + Sharp
- **Scraping**: Playwright

## 📁 Project Structure

```
shp-vid-aff-be/
├── src/
│   ├── config/          # Configuration (env, database, rabbitmq)
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── jobs/            # Queue jobs & workers
│   ├── utils/           # Utilities
│   ├── index.ts         # API Server
│   └── worker.ts        # Background Worker
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Local development
└── package.json
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Variables

สร้างไฟล์ `.env`:

```bash
cp .env.example .env
```

แก้ไขค่า:

```env
# Server
PORT=8000
NODE_ENV=development
HOST=0.0.0.0
CORS_ORIGIN=*
# Production: https://your-frontend.vercel.app

# Database
MONGODB_URI=mongodb://localhost:27017/shopee-video-gen
RABBITMQ_URL=amqp://localhost:5672

# AI
OPENAI_API_KEY=sk-proj-...
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini

# Queue
QUEUE_CONCURRENCY=3
```

### 3. Start MongoDB (Local)

```bash
docker-compose up -d mongodb
```

### 4. Start Development Server

```bash
# Start both API + Worker
bun dev

# Or start separately
bun dev:api     # API only
bun dev:worker  # Worker only
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Products
```
GET    /api/products              # List all products
GET    /api/products/:id          # Get product by ID
PATCH  /api/products/:id          # Update product
DELETE /api/products/:id          # Delete product
GET    /api/products/stats/overview  # Get stats
```

### Upload
```
POST /api/upload/csv              # Upload CSV file
POST /api/upload/validate         # Validate CSV
```

### AI Content Generation
```
POST   /api/ai/generate-content   # Generate AI content
GET    /api/ai/status/:jobId      # Check job status
POST   /api/ai/regenerate/:id     # Regenerate content
GET    /api/ai/queue/stats        # Queue statistics
DELETE /api/ai/jobs/clear         # Clear jobs
```

### Documentation
```
GET /swagger                      # Swagger API docs
```

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t shp-vid-aff-backend .
```

### Run Container

```bash
docker run -d \
  -p 8000:8000 \
  -e MONGODB_URI=mongodb://... \
  -e OPENAI_API_KEY=sk-... \
  -e RABBITMQ_URL=amqp://... \
  shp-vid-aff-backend
```

## ☁️ Deploy to Koyeb

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Configure Koyeb

**Ports:**
- Port: `8000`
- Protocol: HTTP
- Public HTTPS access: ✅

**Environment Variables:**
```
PORT=8000
NODE_ENV=production
MONGODB_URI=<your-mongodb-uri>
OPENAI_API_KEY=<your-api-key>
RABBITMQ_URL=amqp://01.proxy.koyeb.app:21185
```

**Health Check:**
- Path: `/health`
- Port: `8000`

### 3. Deploy

Koyeb จะ auto-deploy เมื่อ push code ใหม่

## 🔧 Available Scripts

```bash
bun dev              # Start API + Worker (development)
bun dev:api          # Start API only
bun dev:worker       # Start Worker only
bun start            # Start API + Worker (production)
bun test             # Run tests
bun lint             # Run ESLint
```

## 🌟 Features

- ✅ RESTful API with Elysia.js
- ✅ Background job processing with RabbitMQ
- ✅ AI content generation (OpenAI/Anthropic)
- ✅ CSV upload and parsing
- ✅ MongoDB data storage
- ✅ Auto-reconnect for databases
- ✅ Health check endpoint
- ✅ Swagger documentation
- ✅ Docker support
- ✅ TypeScript

## 📚 Related Projects

- **Frontend**: [shp-vid-aff](https://github.com/WATCW/shp-vid-aff) - React frontend

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License
