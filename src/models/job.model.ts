import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IJob extends Document {
  jobId?: string // Custom job ID (e.g., "ai-24833107295-1761973547733")
  type: 'ai_content' | 'scrape_product' | 'generate_video'
  productId: Types.ObjectId
  videoId?: Types.ObjectId

  priority: number
  attempts: number
  maxAttempts: number

  data: Record<string, any>
  result?: Record<string, any>
  error?: string

  status: 'waiting' | 'active' | 'completed' | 'failed'
  progress: number

  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

const JobSchema = new Schema<IJob>({
  jobId: {
    type: String,
    unique: true,
    sparse: true, // Allow null for old jobs without jobId
    index: true,
  },

  type: {
    type: String,
    enum: ['ai_content', 'scrape_product', 'generate_video'],
    required: true,
    index: true,
  },

  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },

  videoId: {
    type: Schema.Types.ObjectId,
    ref: 'Video',
  },

  priority: {
    type: Number,
    default: 5,
    min: 0,
    max: 10,
  },

  attempts: {
    type: Number,
    default: 0,
  },

  maxAttempts: {
    type: Number,
    default: 3,
  },

  data: {
    type: Schema.Types.Mixed,
    default: {},
  },

  result: {
    type: Schema.Types.Mixed,
  },

  error: { type: String },

  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'failed'],
    default: 'waiting',
    index: true,
  },

  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  startedAt: { type: Date },
  completedAt: { type: Date },
})

// Indexes
JobSchema.index({ type: 1, status: 1, priority: -1, createdAt: 1 })
JobSchema.index({ productId: 1, type: 1 })

export const Job = mongoose.model<IJob>('Job', JobSchema)

export default Job
