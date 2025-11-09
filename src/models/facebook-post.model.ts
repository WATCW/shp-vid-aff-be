import mongoose, { Document, Schema } from 'mongoose'

export interface IFacebookPost extends Document {
  productId: mongoose.Types.ObjectId
  productName: string
  productPrice: number
  productUrl: string
  affiliateUrl?: string

  // Post content
  caption: string
  hashtags: string[]

  // Facebook response
  facebookPostId?: string
  facebookPhotoIds?: string[]
  facebookPermalinkUrl?: string

  // Status tracking
  status: 'pending' | 'success' | 'failed'
  errorMessage?: string
  errorCode?: number

  // Timestamps
  postedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const FacebookPostSchema = new Schema<IFacebookPost>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productPrice: {
      type: Number,
      required: true,
    },
    productUrl: {
      type: String,
      required: true,
    },
    affiliateUrl: {
      type: String,
    },
    caption: {
      type: String,
      required: true,
    },
    hashtags: {
      type: [String],
      default: [],
    },
    facebookPostId: {
      type: String,
      index: true,
    },
    facebookPhotoIds: {
      type: [String],
      default: [],
    },
    facebookPermalinkUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      index: true,
    },
    errorMessage: {
      type: String,
    },
    errorCode: {
      type: Number,
    },
    postedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for faster queries
FacebookPostSchema.index({ createdAt: -1 })
FacebookPostSchema.index({ status: 1, createdAt: -1 })
FacebookPostSchema.index({ productId: 1, status: 1 })

export const FacebookPost = mongoose.model<IFacebookPost>('FacebookPost', FacebookPostSchema)
