import { getChannel, rabbitmqAvailable, QUEUE_NAMES, ensureRabbitMQ } from '@config/rabbitmq'
import logger from '@utils/logger'
import { Job } from '@models/job.model'

// Export queue initialized state
export let queuesInitialized = false
export { QUEUE_NAMES }

// Job data types
export interface AIContentJobData {
  productId: string
  options?: {
    tone?: string
    style?: string
    language?: string
  }
}

export interface ScraperJobData {
  productId: string
  productUrl: string
}

export interface VideoJobData {
  productId: string
  videoId: string
  templateId?: string
  customConfig?: Record<string, any>
}

// Initialize queues
export const initializeQueues = async (): Promise<boolean> => {
  try {
    const ready = await ensureRabbitMQ()

    if (!ready) {
      logger.warn('⚠️  RabbitMQ not available - Queue features disabled')
      queuesInitialized = false
      return false
    }

    queuesInitialized = true
    logger.info('✅ RabbitMQ queues initialized successfully')
    return true
  } catch (error) {
    logger.error('❌ Failed to initialize queues:', error)
    queuesInitialized = false
    return false
  }
}

// Helper to publish a message to a queue
const publishToQueue = async (
  queueName: string,
  data: any,
  options?: {
    priority?: number
    jobId?: string
  }
): Promise<boolean> => {
  const channel = getChannel()

  if (!channel) {
    logger.warn(`⚠️  Cannot publish to ${queueName} - RabbitMQ not available`)
    return false
  }

  try {
    const message = JSON.stringify({
      ...data,
      jobId: options?.jobId || `${queueName}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    })

    const sent = channel.sendToQueue(
      queueName,
      Buffer.from(message),
      {
        persistent: true, // Message will survive RabbitMQ restarts
        priority: options?.priority || 5,
      }
    )

    if (!sent) {
      logger.warn(`⚠️  Failed to send message to ${queueName} - queue buffer full`)
      return false
    }

    logger.info(`📤 Published job to ${queueName}`)
    return true
  } catch (error) {
    logger.error(`❌ Failed to publish to ${queueName}:`, error)
    return false
  }
}

// Add AI Content Job
export const addAIContentJob = async (
  data: AIContentJobData,
  priority: number = 5
): Promise<string | null> => {
  if (!queuesInitialized) {
    logger.warn('Cannot add AI content job - Queue not initialized (RabbitMQ unavailable)')
    return null
  }

  const jobId = `ai-${data.productId}-${Date.now()}`

  const success = await publishToQueue(QUEUE_NAMES.AI_CONTENT, data, {
    priority,
    jobId,
  })

  return success ? jobId : null
}

// Add Scraper Job
export const addScraperJob = async (
  data: ScraperJobData,
  priority: number = 5
): Promise<string | null> => {
  if (!queuesInitialized) {
    logger.warn('Cannot add scraper job - Queue not initialized (RabbitMQ unavailable)')
    return null
  }

  const jobId = `scraper-${data.productId}-${Date.now()}`

  const success = await publishToQueue(QUEUE_NAMES.SCRAPER, data, {
    priority,
    jobId,
  })

  return success ? jobId : null
}

// Add Video Generation Job
export const addVideoJob = async (
  data: VideoJobData,
  priority: number = 5
): Promise<string | null> => {
  logger.info('[QUEUE] 🎬 Attempting to add video job:', {
    productId: data.productId,
    videoId: data.videoId,
    templateId: data.templateId,
    queuesInitialized,
  })

  if (!queuesInitialized) {
    logger.error('[QUEUE] ❌ Cannot add video job - Queue not initialized (RabbitMQ unavailable)')
    return null
  }

  const jobId = `video-${data.videoId}-${Date.now()}`

  logger.info('[QUEUE] 📤 Publishing to queue:', { jobId, queueName: QUEUE_NAMES.VIDEO })

  const success = await publishToQueue(QUEUE_NAMES.VIDEO, data, {
    priority,
    jobId,
  })

  if (success) {
    logger.info('[QUEUE] ✅ Video job added successfully:', jobId)
  } else {
    logger.error('[QUEUE] ❌ Failed to add video job:', jobId)
  }

  return success ? jobId : null
}

// Get queue stats (counts from MongoDB)
export const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      Job.countDocuments({ status: 'waiting' }),
      Job.countDocuments({ status: 'active' }),
      Job.countDocuments({ status: 'completed' }),
      Job.countDocuments({ status: 'failed' }),
    ])

    return {
      available: rabbitmqAvailable,
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    }
  } catch (error) {
    logger.error('Failed to get queue stats:', error)
    return {
      available: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
    }
  }
}

// Get AI Content queue stats
export const getAIContentStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      Job.countDocuments({ type: 'ai_content', status: 'waiting' }),
      Job.countDocuments({ type: 'ai_content', status: 'active' }),
      Job.countDocuments({ type: 'ai_content', status: 'completed' }),
      Job.countDocuments({ type: 'ai_content', status: 'failed' }),
    ])

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    }
  } catch (error) {
    logger.error('Failed to get AI content stats:', error)
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
    }
  }
}

export default {
  queuesInitialized,
  initializeQueues,
  addAIContentJob,
  addScraperJob,
  addVideoJob,
  getQueueStats,
  getAIContentStats,
}
