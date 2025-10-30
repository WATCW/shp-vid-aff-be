import mongoose from 'mongoose'
import config from './env'
import logger from '@utils/logger'

export const connectDatabase = async () => {
  try {
    logger.info('Connecting to MongoDB...')
    logger.info(`MongoDB URI: ${config.database.mongoUri.replace(/\/\/.*:.*@/, '//***:***@')}`) // Log URI without credentials

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
    logger.error('Please check:')
    logger.error('  1. MONGODB_URI environment variable is set correctly')
    logger.error('  2. MongoDB server is accessible')
    logger.error('  3. Network/firewall settings allow connection')

    // Don't exit immediately in production - let container restart
    if (config.isProduction) {
      logger.error('⚠️  Running in production mode - will retry connection')
      // Throw error to let the process crash and restart
      throw error
    } else {
      process.exit(1)
    }
  }
}

export default connectDatabase
