import axios from 'axios'
import FormData from 'form-data'
import config from '@config/env'
import logger from '@utils/logger'

interface FacebookPost {
  caption: string
  hashtags: string[]
  productUrl: string
  images: Buffer[]
}

interface FacebookPostResult {
  success: boolean
  postId: string
  photoId?: string
  photoIds?: string[]
}

class FacebookService {
  private pageId: string
  private pageAccessToken: string
  private apiVersion: string
  private baseUrl: string

  constructor() {
    this.pageId = process.env.FACEBOOK_PAGE_ID || ''
    this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ''
    this.apiVersion = process.env.FACEBOOK_API_VERSION || 'v23.0'
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`

    if (!this.pageId || !this.pageAccessToken) {
      logger.warn('[Facebook] Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN in environment')
    }
  }

  /**
   * Check if Facebook service is configured
   */
  isConfigured(): boolean {
    return !!(this.pageId && this.pageAccessToken)
  }

  /**
   * สร้างโพสต์ไป Facebook Page
   */
  async createPost({ caption, hashtags, productUrl, images }: FacebookPost): Promise<FacebookPostResult> {
    if (!this.isConfigured()) {
      throw new Error('Facebook API is not configured. Please set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in environment variables.')
    }

    try {
      // Format message: Caption + Hashtags + Product Link
      const hashtagsText = hashtags.join(' ')
      const message = `${caption}\n\n${hashtagsText}\n\n🛒 ซื้อเลย: ${productUrl}`

      logger.info(`[Facebook] Creating post with ${images.length} images`)

      // Single image
      if (images.length === 1) {
        return await this.postSinglePhoto(message, images[0], productUrl)
      }

      // Multiple images
      return await this.postMultiplePhotos(message, images, productUrl)
    } catch (error) {
      logger.error('[Facebook] Post error:', error)
      throw this.handleError(error)
    }
  }

  /**
   * โพสต์รูปเดียว
   */
  private async postSinglePhoto(message: string, imageBuffer: Buffer, link: string): Promise<FacebookPostResult> {
    const formData = new FormData()
    formData.append('message', message)
    formData.append('source', imageBuffer, { filename: 'product.jpg' })
    formData.append('link', link)
    formData.append('access_token', this.pageAccessToken)

    const response = await axios.post(
      `${this.baseUrl}/${this.pageId}/photos`,
      formData,
      { headers: formData.getHeaders() }
    )

    logger.info('[Facebook] Single photo posted:', response.data.post_id)

    return {
      success: true,
      postId: response.data.post_id,
      photoId: response.data.id,
    }
  }

  /**
   * โพสต์หลายรูป
   */
  private async postMultiplePhotos(message: string, imageBuffers: Buffer[], link: string): Promise<FacebookPostResult> {
    // Step 1: Upload photos without publishing
    const uploadedPhotos: { media_fbid: string }[] = []

    for (let i = 0; i < imageBuffers.length; i++) {
      const formData = new FormData()
      formData.append('source', imageBuffers[i], { filename: `product-${i + 1}.jpg` })
      formData.append('published', 'false')
      formData.append('access_token', this.pageAccessToken)

      const response = await axios.post(
        `${this.baseUrl}/${this.pageId}/photos`,
        formData,
        { headers: formData.getHeaders() }
      )

      uploadedPhotos.push({ media_fbid: response.data.id })
      logger.info(`[Facebook] Uploaded photo ${i + 1}/${imageBuffers.length}:`, response.data.id)
    }

    // Step 2: Create feed post with all photos
    const response = await axios.post(
      `${this.baseUrl}/${this.pageId}/feed`,
      {
        message,
        link,
        attached_media: uploadedPhotos,
        access_token: this.pageAccessToken,
      }
    )

    logger.info('[Facebook] Multiple photos posted:', response.data.id)

    return {
      success: true,
      postId: response.data.id,
      photoIds: uploadedPhotos.map((p) => p.media_fbid),
    }
  }

  /**
   * ดูข้อมูล Page
   */
  async getPageInfo() {
    if (!this.isConfigured()) {
      throw new Error('Facebook API is not configured')
    }

    const response = await axios.get(`${this.baseUrl}/${this.pageId}`, {
      params: {
        fields: 'name,fan_count,picture,link',
        access_token: this.pageAccessToken,
      },
    })

    return response.data
  }

  /**
   * ดูสถานะโพสต์
   */
  async getPostStatus(postId: string) {
    if (!this.isConfigured()) {
      throw new Error('Facebook API is not configured')
    }

    const response = await axios.get(`${this.baseUrl}/${postId}`, {
      params: {
        fields: 'id,message,created_time,permalink_url,likes.summary(true),comments.summary(true)',
        access_token: this.pageAccessToken,
      },
    })

    return response.data
  }

  /**
   * ดูรายการโพสต์
   */
  async listPosts(limit = 10) {
    if (!this.isConfigured()) {
      throw new Error('Facebook API is not configured')
    }

    const response = await axios.get(`${this.baseUrl}/${this.pageId}/posts`, {
      params: {
        fields: 'id,message,created_time,permalink_url,full_picture',
        limit,
        access_token: this.pageAccessToken,
      },
    })

    return response.data
  }

  /**
   * ตรวจสอบความถูกต้องของ Access Token
   */
  async validateToken() {
    if (!this.isConfigured()) {
      throw new Error('Facebook API is not configured')
    }

    try {
      const appId = process.env.FACEBOOK_APP_ID
      const appSecret = process.env.FACEBOOK_APP_SECRET

      if (!appId || !appSecret) {
        logger.warn('[Facebook] Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET for token validation')
        return { isValid: false, error: 'App credentials not configured' }
      }

      const response = await axios.get(`${this.baseUrl}/debug_token`, {
        params: {
          input_token: this.pageAccessToken,
          access_token: `${appId}|${appSecret}`,
        },
      })

      const data = response.data.data
      return {
        isValid: data.is_valid,
        expiresAt: data.expires_at,
        scopes: data.scopes,
        userId: data.user_id,
      }
    } catch (error) {
      logger.error('[Facebook] Token validation error:', error)
      return { isValid: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * จัดการ Error จาก Facebook API
   */
  private handleError(error: any): Error {
    const fbError = error.response?.data?.error

    if (!fbError) {
      return new Error('Unknown Facebook API error')
    }

    // Map error codes to user-friendly messages (Thai)
    const errorMessages: { [key: number]: string } = {
      190: 'Facebook Access Token หมดอายุ กรุณาต่ออายุ token',
      368: 'โพสต์เร็วเกินไป กรุณารอสักครู่ (5-10 นาที)',
      506: 'โพสต์นี้ซ้ำกับโพสต์ก่อนหน้า',
      100: 'ข้อมูลไม่ถูกต้อง (รูปภาพหรือข้อความ)',
      200: 'ไม่มีสิทธิ์โพสต์ไป Page นี้',
      10: 'ไม่มีสิทธิ์ใช้งาน Permission นี้',
      1: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      2: 'บริการไม่พร้อมใช้งานชั่วคราว',
      4: 'จำนวนคำขอเกินขีดจำกัด (Rate Limit)',
      17: 'ผู้ใช้ถูกจำกัดการใช้งาน',
      101: 'Missing client_id parameter - กรุณาตรวจสอบ App ID และ App Secret',
    }

    const message = errorMessages[fbError.code] || fbError.message || 'เกิดข้อผิดพลาดจาก Facebook'
    const customError = new Error(message) as any
    customError.code = fbError.code
    customError.type = fbError.type
    customError.fbError = fbError

    return customError
  }
}

export default new FacebookService()
