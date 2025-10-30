import { connectDatabase } from '@config/database'
import Music from '@models/music.model'
import logger from '@utils/logger'

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
  {
    name: 'Energetic Beat',
    description: 'High energy beats',
    category: 'energetic',
    duration: 30,
    filePath: '/assets/music/energetic-beat.mp3',
    fileName: 'energetic-beat.mp3',
    fileSize: 500000,
    format: 'mp3',
    isActive: true,
    isPremium: false,
  },
  {
    name: 'Emotional Piano',
    description: 'Emotional and touching piano melody',
    category: 'emotional',
    duration: 30,
    filePath: '/assets/music/emotional-piano.mp3',
    fileName: 'emotional-piano.mp3',
    fileSize: 500000,
    format: 'mp3',
    isActive: true,
    isPremium: false,
  },
  {
    name: 'Trendy Pop',
    description: 'Modern trendy pop music',
    category: 'trendy',
    duration: 30,
    filePath: '/assets/music/trendy-pop.mp3',
    fileName: 'trendy-pop.mp3',
    fileSize: 500000,
    format: 'mp3',
    isActive: true,
    isPremium: false,
  },
]

const seedMusic = async () => {
  try {
    logger.info('Starting music seeding...')

    // Connect to database
    await connectDatabase()

    // Insert music tracks
    for (const musicData of defaultMusic) {
      const existing = await Music.findOne({ name: musicData.name })

      if (existing) {
        logger.info(`Music "${musicData.name}" already exists, skipping...`)
        continue
      }

      const music = new Music(musicData)
      await music.save()
      logger.info(`Created music: ${musicData.name}`)
    }

    logger.info('Music seeding completed successfully!')
    process.exit(0)
  } catch (error) {
    logger.error('Error seeding music:', error)
    process.exit(1)
  }
}

// Run the seed function
seedMusic()
