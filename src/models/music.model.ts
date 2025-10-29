import mongoose, { Document, Schema } from 'mongoose'

export interface IMusicMetadata {
  artist?: string
  album?: string
  genre?: string
  bpm?: number
  key?: string
}

export interface IMusic extends Document {
  name: string
  description?: string
  category: 'upbeat' | 'calm' | 'energetic' | 'emotional' | 'corporate' | 'trendy'

  filePath: string
  fileName: string
  fileSize: number
  duration: number // Duration in seconds
  format: string // mp3, wav, etc.

  metadata?: IMusicMetadata

  isActive: boolean
  isPremium: boolean

  usageCount: number

  createdAt: Date
  updatedAt: Date
}

const MusicMetadataSchema = new Schema<IMusicMetadata>({
  artist: { type: String },
  album: { type: String },
  genre: { type: String },
  bpm: { type: Number },
  key: { type: String },
}, { _id: false })

const MusicSchema = new Schema<IMusic>({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  description: {
    type: String,
  },

  category: {
    type: String,
    enum: ['upbeat', 'calm', 'energetic', 'emotional', 'corporate', 'trendy'],
    required: true,
    index: true,
  },

  filePath: {
    type: String,
    required: true,
  },

  fileName: {
    type: String,
    required: true,
  },

  fileSize: {
    type: Number,
    required: true,
    min: 0,
  },

  duration: {
    type: Number,
    required: true,
    min: 0,
  },

  format: {
    type: String,
    required: true,
  },

  metadata: {
    type: MusicMetadataSchema,
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },

  isPremium: {
    type: Boolean,
    default: false,
    index: true,
  },

  usageCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
})

// Indexes
MusicSchema.index({ category: 1, isActive: 1 })
MusicSchema.index({ isPremium: 1, isActive: 1 })
MusicSchema.index({ usageCount: -1 })
MusicSchema.index({ duration: 1 })

// Instance methods
MusicSchema.methods.incrementUsage = async function() {
  this.usageCount += 1
  return this.save()
}

export const Music = mongoose.model<IMusic>('Music', MusicSchema)

export default Music
