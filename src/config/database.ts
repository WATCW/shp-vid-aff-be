import mongoose from 'mongoose'
import config from './env'
import logger from '@utils/logger'

export const connectDatabase = async () => {
  try {
    logger.info('Connecting to MongoDB...')

    await mongoose.connect(config.database.mongoUri)

    logger.info('✅ MongoDB connected successfully')

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
    })

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      logger.info('MongoDB connection closed through app termination')
      process.exit(0)
    })

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error)
    process.exit(1)
  }
}

export default connectDatabase
