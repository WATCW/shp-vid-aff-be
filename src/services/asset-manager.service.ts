import Music, { IMusic } from '@models/music.model'
import logger from '@utils/logger'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface MusicFilters {
  category?: string
  isPremium?: boolean
  isActive?: boolean
  minDuration?: number
  maxDuration?: number
}

export interface AssetListOptions {
  page?: number
  limit?: number
  sortBy?: 'name' | 'usageCount' | 'duration' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export class AssetManagerService {
  private musicPath = './assets/music'
  private fontsPath = './assets/fonts'
  private imagesPath = './assets/images'

  /**
   * Get all music tracks with optional filters
   */
  async getMusic(
    filters: MusicFilters = {},
    options: AssetListOptions = {}
  ) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options

      // Build query
      const query: any = {}

      if (filters.category) {
        query.category = filters.category
      }

      if (filters.isPremium !== undefined) {
        query.isPremium = filters.isPremium
      }

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive
      } else {
        query.isActive = true
      }

      if (filters.minDuration) {
        query.duration = { ...query.duration, $gte: filters.minDuration }
      }

      if (filters.maxDuration) {
        query.duration = { ...query.duration, $lte: filters.maxDuration }
      }

      // Execute query
      const skip = (page - 1) * limit
      const sortDirection = sortOrder === 'asc' ? 1 : -1

      const [music, total] = await Promise.all([
        Music.find(query)
          .sort({ [sortBy]: sortDirection })
          .skip(skip)
          .limit(limit)
          .lean(),
        Music.countDocuments(query),
      ])

      return {
        music,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting music:', error)
      throw new Error('Failed to fetch music')
    }
  }

  /**
   * Get a single music track by ID
   */
  async getMusicById(id: string) {
    try {
      const music = await Music.findById(id).lean()

      if (!music) {
        throw new Error('Music not found')
      }

      return music
    } catch (error) {
      logger.error('Error getting music by ID:', error)
      throw error
    }
  }

  /**
   * Get music by category
   */
  async getMusicByCategory(category: string) {
    try {
      const music = await Music.find({
        category,
        isActive: true,
      })
        .sort({ usageCount: -1 })
        .lean()

      return music
    } catch (error) {
      logger.error('Error getting music by category:', error)
      throw new Error('Failed to fetch music by category')
    }
  }

  /**
   * Get random music track
   */
  async getRandomMusic(category?: string) {
    try {
      const query: any = { isActive: true }
      if (category) {
        query.category = category
      }

      const count = await Music.countDocuments(query)
      const random = Math.floor(Math.random() * count)

      const music = await Music.findOne(query).skip(random).lean()

      return music
    } catch (error) {
      logger.error('Error getting random music:', error)
      throw new Error('Failed to fetch random music')
    }
  }

  /**
   * Create a new music entry
   */
  async createMusic(musicData: Partial<IMusic>) {
    try {
      const music = new Music(musicData)
      await music.save()

      logger.info(`Music created: ${music.name}`)
      return music
    } catch (error) {
      logger.error('Error creating music:', error)
      throw new Error('Failed to create music')
    }
  }

  /**
   * Update music entry
   */
  async updateMusic(id: string, updateData: Partial<IMusic>) {
    try {
      const music = await Music.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )

      if (!music) {
        throw new Error('Music not found')
      }

      logger.info(`Music updated: ${music.name}`)
      return music
    } catch (error) {
      logger.error('Error updating music:', error)
      throw error
    }
  }

  /**
   * Delete music (soft delete)
   */
  async deleteMusic(id: string) {
    try {
      const music = await Music.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      )

      if (!music) {
        throw new Error('Music not found')
      }

      logger.info(`Music deleted: ${music.name}`)
      return music
    } catch (error) {
      logger.error('Error deleting music:', error)
      throw error
    }
  }

  /**
   * Increment music usage count
   */
  async incrementMusicUsage(id: string) {
    try {
      const music = await Music.findByIdAndUpdate(
        id,
        { $inc: { usageCount: 1 } },
        { new: true }
      )

      if (!music) {
        throw new Error('Music not found')
      }

      return music
    } catch (error) {
      logger.error('Error incrementing music usage:', error)
      throw error
    }
  }

  /**
   * List available fonts
   */
  async listFonts() {
    try {
      if (!existsSync(this.fontsPath)) {
        return []
      }

      const files = readdirSync(this.fontsPath)
      const fonts = files
        .filter((file) => {
          const ext = file.split('.').pop()?.toLowerCase()
          return ['ttf', 'otf', 'woff', 'woff2'].includes(ext || '')
        })
        .map((file) => {
          const filePath = join(this.fontsPath, file)
          const stats = statSync(filePath)

          return {
            name: file.replace(/\.[^/.]+$/, ''), // Remove extension
            fileName: file,
            filePath,
            fileSize: stats.size,
            format: file.split('.').pop()?.toLowerCase(),
          }
        })

      return fonts
    } catch (error) {
      logger.error('Error listing fonts:', error)
      throw new Error('Failed to list fonts')
    }
  }

  /**
   * List available images
   */
  async listImages() {
    try {
      if (!existsSync(this.imagesPath)) {
        return []
      }

      const files = readdirSync(this.imagesPath)
      const images = files
        .filter((file) => {
          const ext = file.split('.').pop()?.toLowerCase()
          return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')
        })
        .map((file) => {
          const filePath = join(this.imagesPath, file)
          const stats = statSync(filePath)

          return {
            name: file,
            filePath,
            fileSize: stats.size,
            format: file.split('.').pop()?.toLowerCase(),
            url: `/storage/images/${file}`,
          }
        })

      return images
    } catch (error) {
      logger.error('Error listing images:', error)
      throw new Error('Failed to list images')
    }
  }

  /**
   * Get music categories with counts
   */
  async getMusicCategories() {
    try {
      const categories = await Music.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            tracks: { $push: { id: '$_id', name: '$name', duration: '$duration' } },
          },
        },
        { $sort: { count: -1 } },
      ])

      return categories.map((cat) => ({
        category: cat._id,
        count: cat.count,
        tracks: cat.tracks,
      }))
    } catch (error) {
      logger.error('Error getting music categories:', error)
      throw new Error('Failed to fetch music categories')
    }
  }

  /**
   * Get asset stats
   */
  async getStats() {
    try {
      const [totalMusic, activeMusic, premiumMusic, fonts, images] = await Promise.all([
        Music.countDocuments(),
        Music.countDocuments({ isActive: true }),
        Music.countDocuments({ isPremium: true, isActive: true }),
        this.listFonts(),
        this.listImages(),
      ])

      return {
        music: {
          total: totalMusic,
          active: activeMusic,
          premium: premiumMusic,
          free: activeMusic - premiumMusic,
        },
        fonts: fonts.length,
        images: images.length,
      }
    } catch (error) {
      logger.error('Error getting asset stats:', error)
      throw new Error('Failed to fetch asset stats')
    }
  }
}

export default new AssetManagerService()
