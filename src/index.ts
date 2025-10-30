import { Elysia } from 'elysia'
import { staticPlugin } from '@elysiajs/static'
import { swagger } from '@elysiajs/swagger'
import config from '@config/env'
import { connectDatabase } from '@config/database'
import logger from '@utils/logger'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { initializeData } from './scripts/init-data'

// Import routes
import { uploadRoutes } from './routes/upload'
import { productRoutes } from './routes/products'
import { aiRoutes } from './routes/ai'
import { videoRoutes } from './routes/videos'
import { templateRoutes } from './routes/templates'
import { musicRoutes } from './routes/music'

// Ensure storage directories exist
const ensureDirectories = () => {
  const dirs = [
    config.storage.path,
    config.storage.uploadPath,
    './storage/videos',
    './storage/thumbnails',
    './storage/temp',
    './assets/music',
    './assets/fonts',
    './assets/images',
    './assets/templates',
  ]

  dirs.forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
      logger.info(`Created directory: ${dir}`)
    }
  })
}

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase()

    // Ensure storage directories
    ensureDirectories()

    // Initialize default data (templates, music)
    logger.info('Initializing default data...')
    await initializeData()
    logger.info('Default data initialization complete')

    // Create Elysia app
    const app = new Elysia()
      // Manual CORS headers for all responses
      .onRequest(({ set, request }) => {
        set.headers['Access-Control-Allow-Origin'] = request.headers.get('origin') || '*'
        set.headers['Access-Control-Allow-Credentials'] = 'true'
        set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'

        // Handle preflight
        if (request.method === 'OPTIONS') {
          set.status = 204
          return new Response(null, { status: 204 })
        }
      })

      // Add CORS headers to all responses including errors
      .onAfterHandle(({ set, request }) => {
        set.headers['Access-Control-Allow-Origin'] = request.headers.get('origin') || '*'
        set.headers['Access-Control-Allow-Credentials'] = 'true'
      })

      // Swagger Documentation
      .use(
        swagger({
          documentation: {
            info: {
              title: 'Shopee Video Generator API',
              version: '1.0.0',
              description: 'API for generating Shopee affiliate marketing videos',
            },
            tags: [
              { name: 'Upload', description: 'CSV upload endpoints' },
              { name: 'Products', description: 'Product management' },
              { name: 'AI', description: 'AI content generation' },
              { name: 'Videos', description: 'Video generation and management' },
              { name: 'Templates', description: 'Video templates' },
              { name: 'Music', description: 'Music and assets management' },
            ],
          },
          path: '/swagger',
        })
      )

      // Health check (before other routes)
      .get('/health', async () => {
        const { queuesInitialized } = await import('./jobs/queue')

        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.server,
          services: {
            rabbitmq: queuesInitialized,
            mongodb: true, // If we got here, MongoDB is connected
          },
          warnings: !queuesInitialized
            ? ['RabbitMQ is not available - Queue features disabled']
            : undefined,
        }
      })

      // API Routes
      .group('/api', (app) =>
        app
          .use(uploadRoutes)
          .use(productRoutes)
          .use(aiRoutes)
          .use(videoRoutes)
          .use(templateRoutes)
          .use(musicRoutes)
      )

      // Serve uploaded files and videos
      .use(
        staticPlugin({
          assets: './storage',
          prefix: '/storage',
        })
      )

      // Error handler
      .onError(({ code, error, set }) => {
        if (code === 'NOT_FOUND') {
          set.status = 404
          return {
            success: false,
            error: 'Route not found',
          }
        }

        logger.error('Server error:', error)

        set.status = 500
        return {
          success: false,
          error: config.isDevelopment ? error.message : 'Internal server error',
        }
      })

    // Start server
    app.listen(config.server.port, () => {
      logger.info(`
🚀 Backend API Server is running!

📍 Environment: ${config.isDevelopment ? 'Development' : 'Production'}
🌐 API: http://${config.server.host}:${config.server.port}/api
📚 Swagger: http://localhost:${config.server.port}/swagger
❤️  Health: http://localhost:${config.server.port}/health

Press CTRL+C to stop
      `)
    })

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start server
startServer()
