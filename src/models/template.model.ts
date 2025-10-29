import mongoose, { Document, Schema } from 'mongoose'

// Video settings configuration
export interface IVideoSettings {
  resolution: {
    width: number
    height: number
  }
  fps: number
  duration: number // Total video duration in seconds
  backgroundMusic: boolean
}

// Text effects and animations
export interface ITextEffect {
  animation: 'fade' | 'slide' | 'zoom' | 'typewriter' | 'bounce'
  duration: number // Duration per text slide in seconds
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor?: string
  position: 'top' | 'center' | 'bottom'
}

// Image effects and transitions
export interface IImageEffect {
  transition: 'fade' | 'slide' | 'zoom' | 'dissolve' | 'wipe'
  displayTime: number // How long each image displays in seconds
  kenBurns: boolean // Ken Burns effect (pan and zoom)
  filter?: 'none' | 'vintage' | 'vivid' | 'warm' | 'cool'
}

// Layout configuration
export interface ILayout {
  type: 'full' | 'split' | 'grid' | 'carousel'
  textPosition: 'overlay' | 'separate'
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
  padding: number
}

export interface ITemplateConfig {
  duration: number
  transitions: string[]
  textAnimations: string[]
  layout: Record<string, any>
  colorScheme: {
    primary: string
    secondary: string
    accent: string
  }
  // New detailed configuration
  videoSettings: IVideoSettings
  textEffects: ITextEffect
  imageEffects: IImageEffect
  layoutConfig: ILayout
}

export interface ITemplatePreview {
  thumbnailUrl: string
  previewVideoUrl?: string
  description: string
}

export interface ITemplate extends Document {
  name: string
  description: string
  category: 'general' | 'beauty' | 'fashion' | 'tech' | 'food' | 'lifestyle'

  config: ITemplateConfig
  preview: ITemplatePreview

  isActive: boolean
  isPremium: boolean
  usageCount: number

  createdAt: Date
  updatedAt: Date
}

const VideoSettingsSchema = new Schema<IVideoSettings>({
  resolution: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  fps: { type: Number, required: true, default: 30 },
  duration: { type: Number, required: true, default: 15 },
  backgroundMusic: { type: Boolean, default: true },
}, { _id: false })

const TextEffectSchema = new Schema<ITextEffect>({
  animation: {
    type: String,
    enum: ['fade', 'slide', 'zoom', 'typewriter', 'bounce'],
    default: 'fade',
  },
  duration: { type: Number, required: true, default: 3 },
  fontSize: { type: Number, required: true, default: 48 },
  fontFamily: { type: String, default: 'Arial' },
  color: { type: String, default: '#FFFFFF' },
  backgroundColor: { type: String },
  position: {
    type: String,
    enum: ['top', 'center', 'bottom'],
    default: 'bottom',
  },
}, { _id: false })

const ImageEffectSchema = new Schema<IImageEffect>({
  transition: {
    type: String,
    enum: ['fade', 'slide', 'zoom', 'dissolve', 'wipe'],
    default: 'fade',
  },
  displayTime: { type: Number, required: true, default: 3 },
  kenBurns: { type: Boolean, default: false },
  filter: {
    type: String,
    enum: ['none', 'vintage', 'vivid', 'warm', 'cool'],
    default: 'none',
  },
}, { _id: false })

const LayoutConfigSchema = new Schema<ILayout>({
  type: {
    type: String,
    enum: ['full', 'split', 'grid', 'carousel'],
    default: 'full',
  },
  textPosition: {
    type: String,
    enum: ['overlay', 'separate'],
    default: 'overlay',
  },
  margins: {
    top: { type: Number, default: 20 },
    bottom: { type: Number, default: 20 },
    left: { type: Number, default: 20 },
    right: { type: Number, default: 20 },
  },
  padding: { type: Number, default: 10 },
}, { _id: false })

const TemplateConfigSchema = new Schema<ITemplateConfig>({
  duration: { type: Number, required: true },
  transitions: [{ type: String }],
  textAnimations: [{ type: String }],
  layout: { type: Schema.Types.Mixed, default: {} },
  colorScheme: {
    primary: { type: String, required: true },
    secondary: { type: String, required: true },
    accent: { type: String, required: true },
  },
  // New detailed configuration
  videoSettings: {
    type: VideoSettingsSchema,
    required: true,
  },
  textEffects: {
    type: TextEffectSchema,
    required: true,
  },
  imageEffects: {
    type: ImageEffectSchema,
    required: true,
  },
  layoutConfig: {
    type: LayoutConfigSchema,
    required: true,
  },
}, { _id: false })

const TemplatePreviewSchema = new Schema<ITemplatePreview>({
  thumbnailUrl: { type: String, required: true },
  previewVideoUrl: { type: String },
  description: { type: String, required: true },
}, { _id: false })

const TemplateSchema = new Schema<ITemplate>({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  description: {
    type: String,
    required: true,
  },

  category: {
    type: String,
    enum: ['general', 'beauty', 'fashion', 'tech', 'food', 'lifestyle'],
    required: true,
    index: true,
  },

  config: {
    type: TemplateConfigSchema,
    required: true,
  },

  preview: {
    type: TemplatePreviewSchema,
    required: true,
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

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
})

// Indexes
TemplateSchema.index({ category: 1, isActive: 1 })
TemplateSchema.index({ isPremium: 1, isActive: 1 })
TemplateSchema.index({ usageCount: -1 })

// Instance methods
TemplateSchema.methods.incrementUsage = async function() {
  this.usageCount += 1
  return this.save()
}

export const Template = mongoose.model<ITemplate>('Template', TemplateSchema)

export default Template
