import axios from 'axios'
import logger from '@utils/logger'
import FormData from 'form-data'
import { Readable } from 'stream'

/**
 * Google Drive Service for uploading and managing files
 *
 * Required Environment Variables:
 * - GOOGLE_DRIVE_ENABLED: Set to 'true' to enable Google Drive storage
 * - GOOGLE_DRIVE_CLIENT_ID: OAuth 2.0 Client ID
 * - GOOGLE_DRIVE_CLIENT_SECRET: OAuth 2.0 Client Secret
 * - GOOGLE_DRIVE_REFRESH_TOKEN: OAuth 2.0 Refresh Token
 * - GOOGLE_DRIVE_FOLDER_ID: Folder ID where files will be uploaded
 */
export class GoogleDriveService {
  private enabled: boolean
  private clientId: string
  private clientSecret: string
  private refreshToken: string
  private folderId: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor() {
    this.enabled = process.env.GOOGLE_DRIVE_ENABLED === 'true'
    this.clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || ''
    this.clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || ''
    this.refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || ''
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || ''

    if (this.enabled) {
      logger.info('[GOOGLE-DRIVE] ✅ Google Drive storage enabled')
      if (!this.clientId || !this.clientSecret || !this.refreshToken) {
        logger.warn('[GOOGLE-DRIVE] ⚠️  Missing credentials - upload will fail')
      }
    } else {
      logger.info('[GOOGLE-DRIVE] ℹ️  Google Drive storage disabled - using local storage')
    }
  }

  /**
   * Check if Google Drive is enabled
   */
  isEnabled(): boolean {
    return this.enabled && !!this.clientId && !!this.clientSecret && !!this.refreshToken
  }

  /**
   * Get access token (refresh if needed)
   */
  private async getAccessToken(): Promise<string> {
    // If we have a valid token, return it
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    // Refresh the token
    logger.info('[GOOGLE-DRIVE] 🔄 Refreshing access token...')

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      })

      this.accessToken = response.data.access_token
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000 // Subtract 1 min buffer

      logger.info('[GOOGLE-DRIVE] ✅ Access token refreshed')
      return this.accessToken
    } catch (error) {
      logger.error('[GOOGLE-DRIVE] ❌ Failed to refresh access token:', error)
      throw new Error('Failed to refresh Google Drive access token')
    }
  }

  /**
   * Upload a file to Google Drive
   * @param fileBuffer - File content as Buffer
   * @param fileName - Name of the file
   * @param mimeType - MIME type of the file
   * @returns Google Drive file ID and public URL
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ fileId: string; url: string; directUrl: string }> {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled or configured')
    }

    try {
      const accessToken = await this.getAccessToken()

      logger.info(`[GOOGLE-DRIVE] 📤 Uploading file: ${fileName} (${fileBuffer.length} bytes)`)

      // Create metadata
      const metadata = {
        name: fileName,
        parents: this.folderId ? [this.folderId] : undefined,
      }

      // Create form data
      const form = new FormData()
      form.append('metadata', JSON.stringify(metadata), {
        contentType: 'application/json',
      })
      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
      })

      // Upload file
      const uploadResponse = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        form,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...form.getHeaders(),
          },
        }
      )

      const fileId = uploadResponse.data.id

      // Make file publicly accessible
      await axios.post(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
          role: 'reader',
          type: 'anyone',
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      // Get file details including webViewLink
      const fileResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink,webContentLink`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const url = fileResponse.data.webViewLink
      const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`

      logger.info(`[GOOGLE-DRIVE] ✅ File uploaded: ${fileName}`)
      logger.info(`[GOOGLE-DRIVE] 🔗 File ID: ${fileId}`)
      logger.info(`[GOOGLE-DRIVE] 🔗 URL: ${directUrl}`)

      return {
        fileId,
        url,
        directUrl,
      }
    } catch (error: any) {
      logger.error('[GOOGLE-DRIVE] ❌ Upload failed:', error.response?.data || error.message)
      throw new Error(`Failed to upload file to Google Drive: ${error.message}`)
    }
  }

  /**
   * Delete a file from Google Drive
   * @param fileId - Google Drive file ID
   */
  async deleteFile(fileId: string): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled or configured')
    }

    try {
      const accessToken = await this.getAccessToken()

      await axios.delete(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      logger.info(`[GOOGLE-DRIVE] ✅ File deleted: ${fileId}`)
    } catch (error: any) {
      logger.error('[GOOGLE-DRIVE] ❌ Delete failed:', error.response?.data || error.message)
      throw new Error(`Failed to delete file from Google Drive: ${error.message}`)
    }
  }

  /**
   * Get file metadata from Google Drive
   * @param fileId - Google Drive file ID
   */
  async getFileMetadata(fileId: string): Promise<any> {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled or configured')
    }

    try {
      const accessToken = await this.getAccessToken()

      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,webViewLink,webContentLink,createdTime`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      return response.data
    } catch (error: any) {
      logger.error('[GOOGLE-DRIVE] ❌ Get metadata failed:', error.response?.data || error.message)
      throw new Error(`Failed to get file metadata from Google Drive: ${error.message}`)
    }
  }
}

export default new GoogleDriveService()
