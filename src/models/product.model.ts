import mongoose, { Document, Schema } from 'mongoose'

export interface IAIContent {
  caption: string
  hashtags: string[]
  description: string
  keyPoints: string[]
  targetAudience: string
  videoHook?: string
}

export interface IScrapedData {
  images: string[]
  rating?: number
  reviewCount?: number
  category?: string
  attributes?: Record<string, any>
  scrapedAt: Date
}

export interface IProduct extends Document {
  productId: string
  name: string
  price: number
  salesCount: string
  shopName: string
  commissionRate: string
  commission: number
  productUrl: string
  affiliateUrl: string

  aiContent?: IAIContent
  scrapedData?: IScrapedData

  status: 'pending' | 'ai_processing' | 'ready' | 'video_generating' | 'completed' | 'failed'

  uploadedAt: Date
  updatedAt: Date
}

const AIContentSchema = new Schema<IAIContent>({
  caption: { type: String, required: true },
  hashtags: [{ type: String }],
  description: { type: String, required: true },
  keyPoints: [{ type: String }],
  targetAudience: { type: String, required: true },
  videoHook: { type: String },
}, { _id: false })

const ScrapedDataSchema = new Schema<IScrapedData>({
  images: [{ type: String }],
  rating: { type: Number },
  reviewCount: { type: Number },
  category: { type: String },
  attributes: { type: Schema.Types.Mixed },
  scrapedAt: { type: Date, default: Date.now },
}, { _id: false })

const ProductSchema = new Schema<IProduct>({
  productId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    index: 'text', // Enable text search
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  salesCount: {
    type: String,
    required: true,
  },
  shopName: {
    type: String,
    required: true,
    index: true,
  },
  commissionRate: {
    type: String,
    required: true,
  },
  commission: {
    type: Number,
    required: true,
    min: 0,
  },
  productUrl: {
    type: String,
    required: true,
  },
  affiliateUrl: {
    type: String,
    required: true,
  },

  aiContent: AIContentSchema,
  scrapedData: ScrapedDataSchema,

  status: {
    type: String,
    enum: ['pending', 'ai_processing', 'ready', 'video_generating', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },

  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: {
    createdAt: 'uploadedAt',
    updatedAt: 'updatedAt'
  },
})

// Indexes for performance
ProductSchema.index({ status: 1, uploadedAt: -1 })
ProductSchema.index({ shopName: 1, uploadedAt: -1 })

export const Product = mongoose.model<IProduct>('Product', ProductSchema)

export default Product
