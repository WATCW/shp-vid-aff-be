import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IVideoConfig {
  template: string
  duration: number
  resolution: string
  fps: number
  music?: string
}

export interface IVideoContent {
  caption: string
  hashtags: string[]
  overlayText: string[]
}

export interface IVideoAssets {
  images: string[]
  music?: string
}

export interface IVideoOutput {
  filePath: string
  fileName: string
  fileSize: number
  googleDriveId?: string
  googleDriveUrl?: string
  thumbnailPath?: string
}

export interface IVideo extends Document {
  productId: Types.ObjectId
  templateId?: Types.ObjectId

  videoConfig: IVideoConfig
  content: IVideoContent
  assets: IVideoAssets
  output?: IVideoOutput

  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
  renderTime?: number
  uploadedToGoogleDrive: boolean

  generatedAt: Date
  completedAt?: Date
}

const VideoConfigSchema = new Schema<IVideoConfig>({
  template: { type: String, default: 'general' },
  duration: { type: Number, required: true },
  resolution: { type: String, required: true },
  fps: { type: Number, required: true },
  music: { type: String },
}, { _id: false })

const VideoContentSchema = new Schema<IVideoContent>({
  caption: { type: String, required: true },
  hashtags: [{ type: String }],
  overlayText: [{ type: String }],
}, { _id: false })

const VideoAssetsSchema = new Schema<IVideoAssets>({
  images: [{ type: String, required: true }],
  music: { type: String },
}, { _id: false })

const VideoOutputSchema = new Schema<IVideoOutput>({
  filePath: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  googleDriveId: { type: String },
  googleDriveUrl: { type: String },
  thumbnailPath: { type: String },
}, { _id: false })

const VideoSchema = new Schema<IVideo>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },

  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'Template',
    index: true,
  },

  videoConfig: {
    type: VideoConfigSchema,
    required: true,
  },

  content: {
    type: VideoContentSchema,
    required: true,
  },

  assets: {
    type: VideoAssetsSchema,
    required: true,
  },

  output: VideoOutputSchema,

  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued',
    index: true,
  },

  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  error: { type: String },

  renderTime: {
    type: Number,
    min: 0,
  },

  uploadedToGoogleDrive: {
    type: Boolean,
    default: false,
    index: true,
  },

  generatedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  completedAt: { type: Date },
}, {
  timestamps: {
    createdAt: 'generatedAt',
  },
})

// Indexes
VideoSchema.index({ status: 1, generatedAt: -1 })
VideoSchema.index({ productId: 1, status: 1 })

export const Video = mongoose.model<IVideo>('Video', VideoSchema)

export default Video
