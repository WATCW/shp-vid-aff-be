import { connectDatabase } from '@config/database'
import Template from '@models/template.model'
import logger from '@utils/logger'

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
        resolution: {
          width: 1080,
          height: 1920,
        },
        fps: 30,
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
        displayTime: 3,
        kenBurns: false,
        filter: 'none',
      },
      layoutConfig: {
        type: 'full',
        textPosition: 'overlay',
        margins: {
          top: 20,
          bottom: 80,
          left: 20,
          right: 20,
        },
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
        resolution: {
          width: 1080,
          height: 1920,
        },
        fps: 30,
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
        displayTime: 3,
        kenBurns: true,
        filter: 'warm',
      },
      layoutConfig: {
        type: 'full',
        textPosition: 'overlay',
        margins: {
          top: 40,
          bottom: 40,
          left: 30,
          right: 30,
        },
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
        resolution: {
          width: 1080,
          height: 1920,
        },
        fps: 30,
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
        displayTime: 3,
        kenBurns: true,
        filter: 'vivid',
      },
      layoutConfig: {
        type: 'split',
        textPosition: 'separate',
        margins: {
          top: 20,
          bottom: 20,
          left: 20,
          right: 20,
        },
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
  {
    name: 'Tech Pulse',
    description: 'Dynamic template for technology and gadgets',
    category: 'tech',
    config: {
      duration: 20,
      transitions: ['zoom', 'wipe'],
      textAnimations: ['typewriter', 'bounce'],
      layout: {},
      colorScheme: {
        primary: '#1E90FF',
        secondary: '#000000',
        accent: '#00FF00',
      },
      videoSettings: {
        resolution: {
          width: 1080,
          height: 1920,
        },
        fps: 60,
        duration: 20,
        backgroundMusic: true,
      },
      textEffects: {
        animation: 'typewriter',
        duration: 3,
        fontSize: 50,
        fontFamily: 'Courier New',
        color: '#00FF00',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        position: 'bottom',
      },
      imageEffects: {
        transition: 'zoom',
        displayTime: 3.5,
        kenBurns: true,
        filter: 'cool',
      },
      layoutConfig: {
        type: 'grid',
        textPosition: 'overlay',
        margins: {
          top: 30,
          bottom: 30,
          left: 25,
          right: 25,
        },
        padding: 12,
      },
    },
    preview: {
      thumbnailUrl: '/assets/templates/tech-pulse-thumb.jpg',
      description: 'Dynamic, high-energy design for tech products',
    },
    isActive: true,
    isPremium: false,
  },
  {
    name: 'Food Delight',
    description: 'Appetizing template for food and beverage products',
    category: 'food',
    config: {
      duration: 15,
      transitions: ['fade', 'zoom'],
      textAnimations: ['bounce', 'fade'],
      layout: {},
      colorScheme: {
        primary: '#FF6347',
        secondary: '#FFFACD',
        accent: '#32CD32',
      },
      videoSettings: {
        resolution: {
          width: 1080,
          height: 1920,
        },
        fps: 30,
        duration: 15,
        backgroundMusic: true,
      },
      textEffects: {
        animation: 'bounce',
        duration: 2.5,
        fontSize: 54,
        fontFamily: 'Comic Sans MS',
        color: '#FFFFFF',
        backgroundColor: 'rgba(255, 99, 71, 0.8)',
        position: 'center',
      },
      imageEffects: {
        transition: 'zoom',
        displayTime: 3,
        kenBurns: true,
        filter: 'warm',
      },
      layoutConfig: {
        type: 'full',
        textPosition: 'overlay',
        margins: {
          top: 25,
          bottom: 25,
          left: 25,
          right: 25,
        },
        padding: 10,
      },
    },
    preview: {
      thumbnailUrl: '/assets/templates/food-delight-thumb.jpg',
      description: 'Vibrant, appetizing design for food products',
    },
    isActive: true,
    isPremium: false,
  },
]

const seedTemplates = async () => {
  try {
    logger.info('Starting template seeding...')

    // Connect to database
    await connectDatabase()

    // Clear existing templates (optional - comment out if you want to keep existing)
    // await Template.deleteMany({})
    // logger.info('Cleared existing templates')

    // Insert templates
    for (const templateData of defaultTemplates) {
      const existing = await Template.findOne({ name: templateData.name })

      if (existing) {
        logger.info(`Template "${templateData.name}" already exists, skipping...`)
        continue
      }

      const template = new Template(templateData)
      await template.save()
      logger.info(`Created template: ${templateData.name}`)
    }

    logger.info('Template seeding completed successfully!')
    process.exit(0)
  } catch (error) {
    logger.error('Error seeding templates:', error)
    process.exit(1)
  }
}

// Run the seed function
seedTemplates()
