import { connectDatabase } from '@config/database'
import Template from '@models/template.model'
import Music from '@models/music.model'
import logger from '@utils/logger'

// Import seed data
const defaultTemplates = [
  {
    name: 'Modern Minimal',
    description: 'Clean and minimal design perfect for all product types',
    category: 'general',
    config: {
      duration: 15,
      transitions: ['fade', 'slide'],
      textAnimations: ['fade', 'slide'],
      layout: {},
      colorScheme: {
        primary: '#000000',
        secondary: '#FFFFFF',
        accent: '#FF6B6B',
      },
      videoSettings: {
        resolution: { width: 720, height: 1280 },
        fps: 24,
        duration: 15,
        backgroundMusic: true,
      },
      textEffects: {
        animation: 'fade',
        duration: 3,
        fontSize: 48,
        fontFamily: 'Arial',
        color: '#FFFFFF',
        position: 'bottom',
      },
      imageEffects: {
        transition: 'fade',
        displayTime: 5, // Increased from 3 to 5 seconds per image
        kenBurns: false,
        filter: 'none',
      },
      layoutConfig: {
        type: 'full',
        textPosition: 'overlay',
        margins: { top: 20, bottom: 80, left: 20, right: 20 },
        padding: 10,
      },
    },
    preview: {
      thumbnailUrl: '/assets/templates/modern-minimal-thumb.jpg',
      description: 'Clean minimal design with smooth transitions',
    },
    isActive: true,
    isPremium: false,
  },
  {
    name: 'Beauty Glow',
    description: 'Elegant template designed for beauty and cosmetic products',
    category: 'beauty',
    config: {
      duration: 15,
      transitions: ['fade', 'dissolve'],
      textAnimations: ['fade', 'zoom'],
      layout: {},
      colorScheme: {
        primary: '#FFB6C1',
        secondary: '#FFF5EE',
        accent: '#FF69B4',
      },
      videoSettings: {
        resolution: { width: 720, height: 1280 },
        fps: 24,
        duration: 15,
        backgroundMusic: true,
      },
      textEffects: {
        animation: 'zoom',
        duration: 3,
        fontSize: 52,
        fontFamily: 'Georgia',
        color: '#FFFFFF',
        backgroundColor: 'rgba(255, 182, 193, 0.5)',
        position: 'center',
      },
      imageEffects: {
        transition: 'dissolve',
        displayTime: 5,
        kenBurns: true,
        filter: 'warm',
      },
      layoutConfig: {
        type: 'full',
        textPosition: 'overlay',
        margins: { top: 40, bottom: 40, left: 30, right: 30 },
        padding: 15,
      },
    },
    preview: {
      thumbnailUrl: '/assets/templates/beauty-glow-thumb.jpg',
      description: 'Soft, elegant design for beauty products',
    },
    isActive: true,
    isPremium: false,
  },
  {
    name: 'Fashion Forward',
    description: 'Bold and trendy template for fashion items',
    category: 'fashion',
    config: {
      duration: 18,
      transitions: ['slide', 'wipe'],
      textAnimations: ['slide', 'typewriter'],
      layout: {},
      colorScheme: {
        primary: '#000000',
        secondary: '#FFFFFF',
        accent: '#FFD700',
      },
      videoSettings: {
        resolution: { width: 720, height: 1280 },
        fps: 24,
        duration: 18,
        backgroundMusic: true,
      },
      textEffects: {
        animation: 'slide',
        duration: 2.5,
        fontSize: 56,
        fontFamily: 'Helvetica',
        color: '#000000',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        position: 'top',
      },
      imageEffects: {
        transition: 'slide',
        displayTime: 5,
        kenBurns: true,
        filter: 'vivid',
      },
      layoutConfig: {
        type: 'split',
        textPosition: 'separate',
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        padding: 10,
      },
    },
    preview: {
      thumbnailUrl: '/assets/templates/fashion-forward-thumb.jpg',
      description: 'Bold, trendy design for fashion products',
    },
    isActive: true,
    isPremium: false,
  },
]

const defaultMusic = [
  {
    name: 'Upbeat Energy',
    description: 'Energetic and uplifting background music',
    category: 'upbeat',
    duration: 30,
    filePath: '/assets/music/upbeat-energy.mp3',
    fileName: 'upbeat-energy.mp3',
    fileSize: 500000,
    format: 'mp3',
    isActive: true,
    isPremium: false,
  },
  {
    name: 'Chill Vibes',
    description: 'Relaxing and calm background music',
    category: 'calm',
    duration: 30,
    filePath: '/assets/music/chill-vibes.mp3',
    fileName: 'chill-vibes.mp3',
    fileSize: 500000,
    format: 'mp3',
    isActive: true,
    isPremium: false,
  },
  {
    name: 'Corporate Professional',
    description: 'Professional and modern corporate music',
    category: 'corporate',
    duration: 30,
    filePath: '/assets/music/corporate-professional.mp3',
    fileName: 'corporate-professional.mp3',
    fileSize: 500000,
    format: 'mp3',
    isActive: true,
    isPremium: false,
  },
]

const initializeData = async () => {
  try {
    logger.info('🌱 Starting data initialization...')

    await connectDatabase()

    // Seed Templates
    let templatesCreated = 0
    for (const templateData of defaultTemplates) {
      const existing = await Template.findOne({ name: templateData.name })
      if (!existing) {
        await Template.create(templateData)
        templatesCreated++
        logger.info(`✅ Created template: ${templateData.name}`)
      }
    }
    logger.info(`📋 Templates: ${templatesCreated} created, ${defaultTemplates.length - templatesCreated} already exist`)

    // Seed Music
    let musicCreated = 0
    for (const musicData of defaultMusic) {
      const existing = await Music.findOne({ name: musicData.name })
      if (!existing) {
        await Music.create(musicData)
        musicCreated++
        logger.info(`✅ Created music: ${musicData.name}`)
      }
    }
    logger.info(`🎵 Music: ${musicCreated} created, ${defaultMusic.length - musicCreated} already exist`)

    logger.info('✨ Data initialization completed successfully!')
  } catch (error) {
    logger.error('❌ Error initializing data:', error)
    throw error
  }
}

// Run only if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export { initializeData }
