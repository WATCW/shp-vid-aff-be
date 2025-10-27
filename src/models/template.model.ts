import mongoose, { Document, Schema } from 'mongoose'

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
}

export interface ITemplate extends Document {
  name: string
  description: string
  category: 'beauty' | 'fashion' | 'tech' | 'general'

  config: ITemplateConfig

  preview?: string
  isActive: boolean
  usageCount: number

  createdAt: Date
  updatedAt: Date
}

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
    enum: ['beauty', 'fashion', 'tech', 'general'],
    required: true,
    index: true,
  },

  config: {
    type: TemplateConfigSchema,
    required: true,
  },

  preview: { type: String },

  isActive: {
    type: Boolean,
    default: true,
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

export const Template = mongoose.model<ITemplate>('Template', TemplateSchema)

export default Template
