import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import logger from '@utils/logger'
import Video, { IVideo } from '@models/video.model'
import Template, { ITemplate } from '@models/template.model'
import Music from '@models/music.model'
import Product from '@models/product.model'

export interface VideoGenerationConfig {
  productId: string
  templateId?: string
  musicId?: string
  customText?: string[]
}

export interface VideoScene {
  image: string
  text: string
  duration: number
  transition: string
}

export class VideoGeneratorService {
  private tempPath = './storage/temp'
  private videosPath = './storage/videos'
  private thumbnailsPath = './storage/thumbnails'

  constructor() {
    // Ensure directories exist
    [this.tempPath, this.videosPath, this.thumbnailsPath].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * Generate video for a product
   */
  async generateVideo(config: VideoGenerationConfig, progressCallback?: (progress: number) => void) {
    const startTime = Date.now()

    try {
      // Fetch product and validate
      const product = await Product.findById(config.productId)
      if (!product) {
        throw new Error('Product not found')
      }

      if (!product.aiContent) {
        throw new Error('Product does not have AI content generated')
      }

      // Fetch template
      let template: ITemplate | null = null
      if (config.templateId) {
        template = await Template.findById(config.templateId)
        if (!template) {
          throw new Error('Template not found')
        }
      } else {
        // Use default template
        template = await Template.findOne({ name: 'Modern Minimal' })
        if (!template) {
          throw new Error('Default template not found')
        }
      }

      // Create video record
      const videoId = nanoid()
      const video = new Video({
        productId: product._id,
        templateId: template._id,
        videoConfig: {
          template: template.name,
          duration: template.config.videoSettings.duration,
          resolution: `${template.config.videoSettings.resolution.width}x${template.config.videoSettings.resolution.height}`,
          fps: template.config.videoSettings.fps,
          music: config.musicId,
        },
        content: {
          caption: product.aiContent.caption,
          hashtags: product.aiContent.hashtags || [],
          overlayText: config.customText || product.aiContent.keyPoints || [],
        },
        assets: {
          images: product.images || [],
          music: config.musicId,
        },
        status: 'processing',
        progress: 0,
      })

      await video.save()

      // Update progress
      if (progressCallback) progressCallback(10)

      // Prepare scenes
      const scenes = await this.prepareScenes(product, template, config.customText)
      if (progressCallback) progressCallback(30)

      // Process images and create video scenes
      const processedScenes = await this.processScenes(scenes, template)
      if (progressCallback) progressCallback(50)

      // Generate video
      const videoPath = await this.createVideoFromScenes(
        processedScenes,
        template,
        videoId,
        config.musicId,
        (progress) => {
          if (progressCallback) progressCallback(50 + progress * 0.4)
        }
      )

      if (progressCallback) progressCallback(90)

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(videoPath, videoId)
      if (progressCallback) progressCallback(95)

      // Update video record
      const { size } = await import('fs/promises').then((fs) => fs.stat(videoPath))
      video.output = {
        filePath: videoPath,
        fileName: `${videoId}.mp4`,
        fileSize: size,
        thumbnailPath,
      }
      video.status = 'completed'
      video.progress = 100
      video.renderTime = Date.now() - startTime
      video.completedAt = new Date()

      await video.save()

      // Increment template usage
      if (template) {
        await Template.findByIdAndUpdate(template._id, { $inc: { usageCount: 1 } })
      }

      // Increment music usage
      if (config.musicId) {
        await Music.findByIdAndUpdate(config.musicId, { $inc: { usageCount: 1 } })
      }

      if (progressCallback) progressCallback(100)

      logger.info(`Video generated successfully: ${videoId} in ${Date.now() - startTime}ms`)

      return video
    } catch (error) {
      logger.error('Error generating video:', error)
      throw error
    }
  }

  /**
   * Prepare video scenes from product data
   */
  private async prepareScenes(
    product: any,
    template: ITemplate,
    customText?: string[]
  ): Promise<VideoScene[]> {
    const scenes: VideoScene[] = []
    const images = product.images || []
    const textSlides = customText || product.aiContent?.keyPoints || []
    const sceneDuration = template.config.imageEffects.displayTime

    // Create scenes from images with text overlays
    const maxScenes = Math.min(images.length, textSlides.length)

    for (let i = 0; i < maxScenes; i++) {
      scenes.push({
        image: images[i],
        text: textSlides[i],
        duration: sceneDuration,
        transition: template.config.imageEffects.transition,
      })
    }

    // If we have more images than text, add remaining images without text
    if (images.length > textSlides.length) {
      for (let i = textSlides.length; i < images.length; i++) {
        scenes.push({
          image: images[i],
          text: '',
          duration: sceneDuration,
          transition: template.config.imageEffects.transition,
        })
      }
    }

    return scenes
  }

  /**
   * Process scenes with image effects and text overlays
   */
  private async processScenes(
    scenes: VideoScene[],
    template: ITemplate
  ): Promise<string[]> {
    const processedPaths: string[] = []
    const { resolution } = template.config.videoSettings
    const { filter } = template.config.imageEffects

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const outputPath = join(this.tempPath, `scene-${i}-${nanoid()}.png`)

      try {
        let imageProcessor = sharp(scene.image)
          .resize(resolution.width, resolution.height, {
            fit: 'cover',
            position: 'center',
          })

        // Apply filter
        if (filter && filter !== 'none') {
          imageProcessor = this.applyImageFilter(imageProcessor, filter)
        }

        await imageProcessor.toFile(outputPath)

        processedPaths.push(outputPath)
      } catch (error) {
        logger.error(`Error processing scene ${i}:`, error)
        throw error
      }
    }

    return processedPaths
  }

  /**
   * Apply image filter
   */
  private applyImageFilter(processor: sharp.Sharp, filter: string): sharp.Sharp {
    switch (filter) {
      case 'vintage':
        return processor.modulate({ saturation: 0.7, brightness: 0.9 }).tint({ r: 255, g: 240, b: 220 })
      case 'vivid':
        return processor.modulate({ saturation: 1.3, brightness: 1.1 })
      case 'warm':
        return processor.tint({ r: 255, g: 245, b: 235 })
      case 'cool':
        return processor.tint({ r: 235, g: 245, b: 255 })
      default:
        return processor
    }
  }

  /**
   * Create video from processed scenes using FFmpeg
   */
  private async createVideoFromScenes(
    scenePaths: string[],
    template: ITemplate,
    videoId: string,
    musicId?: string,
    progressCallback?: (progress: number) => void
  ): Promise<string> {
    const outputPath = join(this.videosPath, `${videoId}.mp4`)
    const { resolution, fps } = template.config.videoSettings
    const sceneDuration = template.config.imageEffects.displayTime

    // Create input file list for FFmpeg
    const inputListPath = join(this.tempPath, `input-${videoId}.txt`)
    const inputListContent = scenePaths
      .map((path) => `file '${path}'\nduration ${sceneDuration}`)
      .join('\n')

    writeFileSync(inputListPath, inputListContent)

    return new Promise((resolve, reject) => {
      let command = ffmpeg()
        .input(inputListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          `-vf scale=${resolution.width}:${resolution.height}`,
          `-r ${fps}`,
          '-pix_fmt yuv420p',
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
        ])

      // Add music if specified
      if (musicId) {
        Music.findById(musicId).then((music) => {
          if (music && existsSync(music.filePath)) {
            command = command
              .input(music.filePath)
              .outputOptions([
                '-c:a aac',
                '-b:a 128k',
                '-shortest',
              ])
          }
        })
      }

      command
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.info('FFmpeg process started:', commandLine)
        })
        .on('progress', (progress) => {
          if (progressCallback && progress.percent) {
            progressCallback(progress.percent / 100)
          }
        })
        .on('end', () => {
          // Cleanup temp files
          scenePaths.forEach((path) => {
            try {
              if (existsSync(path)) unlinkSync(path)
            } catch (err) {
              logger.warn(`Failed to delete temp file: ${path}`)
            }
          })

          try {
            if (existsSync(inputListPath)) unlinkSync(inputListPath)
          } catch (err) {
            logger.warn(`Failed to delete input list: ${inputListPath}`)
          }

          resolve(outputPath)
        })
        .on('error', (err) => {
          logger.error('FFmpeg error:', err)
          reject(err)
        })
        .run()
    })
  }

  /**
   * Generate thumbnail from video
   */
  private async generateThumbnail(videoPath: string, videoId: string): Promise<string> {
    const thumbnailPath = join(this.thumbnailsPath, `${videoId}.jpg`)

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: `${videoId}.jpg`,
          folder: this.thumbnailsPath,
          size: '1080x1920',
        })
        .on('end', () => {
          resolve(thumbnailPath)
        })
        .on('error', (err) => {
          logger.error('Error generating thumbnail:', err)
          reject(err)
        })
    })
  }

  /**
   * Get video by ID
   */
  async getVideoById(id: string) {
    try {
      const video = await Video.findById(id)
        .populate('productId')
        .populate('templateId')
        .lean()

      if (!video) {
        throw new Error('Video not found')
      }

      return video
    } catch (error) {
      logger.error('Error getting video by ID:', error)
      throw error
    }
  }

  /**
   * Get videos by product ID
   */
  async getVideosByProductId(productId: string) {
    try {
      const videos = await Video.find({ productId })
        .populate('templateId')
        .sort({ createdAt: -1 })
        .lean()

      return videos
    } catch (error) {
      logger.error('Error getting videos by product ID:', error)
      throw new Error('Failed to fetch videos')
    }
  }

  /**
   * Delete video
   */
  async deleteVideo(id: string) {
    try {
      const video = await Video.findById(id)

      if (!video) {
        throw new Error('Video not found')
      }

      // Delete video file
      if (video.output?.filePath && existsSync(video.output.filePath)) {
        unlinkSync(video.output.filePath)
      }

      // Delete thumbnail
      if (video.output?.thumbnailPath && existsSync(video.output.thumbnailPath)) {
        unlinkSync(video.output.thumbnailPath)
      }

      // Delete database record
      await Video.findByIdAndDelete(id)

      logger.info(`Video deleted: ${id}`)

      return { success: true }
    } catch (error) {
      logger.error('Error deleting video:', error)
      throw error
    }
  }
}

export default new VideoGeneratorService()
