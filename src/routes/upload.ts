import { Elysia, t } from 'elysia'
import csvParserService from '@services/csv-parser.service'
import { Product } from '@models/product.model'
import logger from '@utils/logger'
import { writeFileSync } from 'fs'
import { join } from 'path'
import config from '@config/env'
import { nanoid } from 'nanoid'

export const uploadRoutes = new Elysia({ prefix: '/upload' })
  /**
   * Upload and parse CSV file
   */
  .post(
    '/csv',
    async ({ body }) => {
      try {
        logger.info('📥 [UPLOAD] CSV upload request received')
        const file = body.file

        if (!file) {
          logger.warn('❌ [UPLOAD] No file provided in request')
          return {
            success: false,
            error: 'No file provided',
          }
        }

        logger.info(`📄 [UPLOAD] File received: ${file.name} (${file.size} bytes, type: ${file.type})`)

        // Validate file type
        if (!file.name.endsWith('.csv')) {
          logger.warn(`❌ [UPLOAD] Invalid file type: ${file.name}`)
          return {
            success: false,
            error: 'Invalid file type. Only CSV files are allowed',
          }
        }

        // Validate file size
        if (file.size > config.storage.maxFileSize) {
          logger.warn(`❌ [UPLOAD] File too large: ${file.size} bytes (max: ${config.storage.maxFileSize})`)
          return {
            success: false,
            error: `File too large. Max size: ${config.storage.maxFileSize / 1024 / 1024}MB`,
          }
        }

        logger.info(`✅ [UPLOAD] File validation passed: ${file.name}`)

        // Read file buffer
        logger.info(`📖 [UPLOAD] Reading file buffer...`)
        const buffer = Buffer.from(await file.arrayBuffer())
        logger.info(`✅ [UPLOAD] Buffer created: ${buffer.length} bytes`)

        // Validate CSV structure first
        logger.info(`🔍 [UPLOAD] Validating CSV structure...`)
        const structureValidation = await csvParserService.validateCSVStructure(buffer)
        if (!structureValidation.valid) {
          logger.error(`❌ [UPLOAD] CSV structure validation failed: ${structureValidation.error}`)
          logger.error(`📋 [UPLOAD] Found headers: ${structureValidation.headers?.join(', ')}`)
          return {
            success: false,
            error: structureValidation.error,
            headers: structureValidation.headers,
          }
        }
        logger.info(`✅ [UPLOAD] CSV structure valid. Headers: ${structureValidation.headers?.join(', ')}`)

        // Parse CSV
        logger.info(`🔄 [UPLOAD] Parsing CSV data...`)
        const parseResult = await csvParserService.parseCSV(buffer)

        if (!parseResult.success) {
          logger.error(`❌ [UPLOAD] CSV parsing failed. Total: ${parseResult.total}, Valid: ${parseResult.validCount}, Errors: ${parseResult.errorCount}`)
          parseResult.errors.slice(0, 5).forEach(err => {
            logger.error(`   Row ${err.row}: ${err.message} (field: ${err.field})`)
          })
          return {
            success: false,
            error: 'CSV parsing failed',
            details: parseResult.errors,
            stats: {
              total: parseResult.total,
              valid: parseResult.validCount,
              errors: parseResult.errorCount,
            },
          }
        }
        logger.info(`✅ [UPLOAD] CSV parsing successful. Total: ${parseResult.total}, Valid: ${parseResult.validCount}`)

        // Save CSV file for reference
        logger.info(`💾 [UPLOAD] Saving CSV file...`)
        const uploadId = nanoid(10)
        const fileName = `${uploadId}_${file.name}`
        const filePath = join(config.storage.uploadPath, fileName)
        writeFileSync(filePath, buffer)
        logger.info(`✅ [UPLOAD] CSV file saved: ${filePath}`)

        // Save products to database
        logger.info(`📊 [UPLOAD] Saving ${parseResult.data.length} products to database...`)
        const savedProducts = []
        const duplicates = []
        const errors = []

        for (const product of parseResult.data) {
          try {
            // Check if product already exists
            const existing = await Product.findOne({ productId: product.productId })

            if (existing) {
              logger.info(`⚠️  [UPLOAD] Duplicate product found: ${product.productId} - ${product.name}`)
              duplicates.push({
                productId: product.productId,
                name: product.name,
                existingId: existing._id,
              })
              continue
            }

            // Create new product
            const newProduct = await Product.create(product)
            logger.info(`✅ [UPLOAD] Product saved: ${product.productId} - ${product.name}`)
            savedProducts.push(newProduct)

          } catch (error) {
            logger.error(`❌ [UPLOAD] Failed to save product ${product.productId}:`, error)
            errors.push({
              productId: product.productId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        logger.info(`🎉 [UPLOAD] Upload complete! Saved: ${savedProducts.length}, Duplicates: ${duplicates.length}, Errors: ${errors.length}`)

        return {
          success: true,
          uploadId,
          fileName,
          stats: {
            total: parseResult.total,
            parsed: parseResult.validCount,
            saved: savedProducts.length,
            duplicates: duplicates.length,
            errors: errors.length,
          },
          products: savedProducts.map((p) => ({
            id: p._id,
            productId: p.productId,
            name: p.name,
            price: p.price,
            commission: p.commission,
            shopName: p.shopName,
            status: p.status,
          })),
          duplicates,
          errors: errors.length > 0 ? errors : undefined,
        }

      } catch (error) {
        logger.error('CSV upload failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process CSV',
        }
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: config.storage.maxFileSize,
        }),
      }),
      detail: {
        tags: ['Upload'],
        summary: 'Upload CSV file',
        description: 'Upload and parse Shopee affiliate CSV file',
      },
    }
  )

  /**
   * Validate CSV without saving
   */
  .post(
    '/validate',
    async ({ body }) => {
      try {
        const file = body.file

        if (!file || !file.name.endsWith('.csv')) {
          return {
            success: false,
            error: 'Invalid file',
          }
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        // Validate structure
        const structureValidation = await csvParserService.validateCSVStructure(buffer)
        if (!structureValidation.valid) {
          return {
            success: false,
            valid: false,
            error: structureValidation.error,
          }
        }

        // Parse to get stats
        const parseResult = await csvParserService.parseCSV(buffer)

        return {
          success: true,
          valid: parseResult.success,
          stats: {
            total: parseResult.total,
            valid: parseResult.validCount,
            errors: parseResult.errorCount,
          },
          errors: parseResult.errors.slice(0, 10), // Return first 10 errors only
        }

      } catch (error) {
        logger.error('CSV validation failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        }
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
      detail: {
        tags: ['Upload'],
        summary: 'Validate CSV file',
        description: 'Validate CSV structure without saving to database',
      },
    }
  )
