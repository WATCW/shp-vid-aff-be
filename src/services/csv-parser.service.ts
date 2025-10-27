import { parse } from 'csv-parse/sync'
import logger from '@utils/logger'
import { z } from 'zod'

// Zod schema for CSV row validation
const csvRowSchema = z.object({
  'รหัสสินค้า': z.string().min(1, 'Product ID is required'),
  'ชื่อสินค้า': z.string().min(1, 'Product name is required'),
  'ราคา': z.string().transform((val) => {
    // Remove commas and convert to number
    const num = parseFloat(val.replace(/,/g, '').replace(/[^\d.]/g, ''))
    return isNaN(num) ? 0 : num
  }),
  'ขาย': z.string(),
  'ชื่อร้านค้า': z.string().min(1, 'Shop name is required'),
  'อัตราค่าคอมมิชชัน': z.string(),
  'คอมมิชชัน': z.string().transform((val) => {
    // Remove ฿ symbol and convert to number
    const num = parseFloat(val.replace(/฿/g, '').replace(/,/g, '').trim())
    return isNaN(num) ? 0 : num
  }),
  'ลิงก์สินค้า': z.string().url('Invalid product URL'),
  'ลิงก์ข้อเสนอ': z.string().url('Invalid affiliate URL'),
})

export type CSVRow = z.infer<typeof csvRowSchema>

export interface ParsedProduct {
  productId: string
  name: string
  price: number
  salesCount: string
  shopName: string
  commissionRate: string
  commission: number
  productUrl: string
  affiliateUrl: string
}

export interface CSVParseResult {
  success: boolean
  data: ParsedProduct[]
  errors: Array<{
    row: number
    field?: string
    message: string
    data?: any
  }>
  total: number
  validCount: number
  errorCount: number
}

export class CSVParserService {
  /**
   * Parse CSV file buffer and validate data
   */
  async parseCSV(fileBuffer: Buffer): Promise<CSVParseResult> {
    const result: CSVParseResult = {
      success: false,
      data: [],
      errors: [],
      total: 0,
      validCount: 0,
      errorCount: 0,
    }

    try {
      logger.info('🔄 [CSV-PARSER] Starting CSV data parsing...')

      // Parse CSV with headers
      const records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true, // Handle BOM for Thai characters
      }) as Record<string, string>[]

      result.total = records.length
      logger.info(`📊 [CSV-PARSER] Found ${records.length} data rows to parse`)

      // Validate and transform each row
      records.forEach((record, index) => {
        try {
          logger.info(`🔍 [CSV-PARSER] Processing row ${index + 2}: ${record['ชื่อสินค้า']?.substring(0, 50)}...`)

          // Validate with Zod
          const validated = csvRowSchema.parse(record)

          // Transform to internal format
          const product: ParsedProduct = {
            productId: validated['รหัสสินค้า'],
            name: validated['ชื่อสินค้า'],
            price: validated['ราคา'],
            salesCount: validated['ขาย'],
            shopName: validated['ชื่อร้านค้า'],
            commissionRate: validated['อัตราค่าคอมมิชชัน'],
            commission: validated['คอมมิชชัน'],
            productUrl: validated['ลิงก์สินค้า'],
            affiliateUrl: validated['ลิงก์ข้อเสนอ'],
          }

          result.data.push(product)
          result.validCount++
          logger.info(`✅ [CSV-PARSER] Row ${index + 2} validated successfully`)

        } catch (error) {
          result.errorCount++

          if (error instanceof z.ZodError) {
            error.errors.forEach((err) => {
              logger.error(`❌ [CSV-PARSER] Row ${index + 2} validation error - ${err.path.join('.')}: ${err.message}`)
              result.errors.push({
                row: index + 2, // +2 because: +1 for header, +1 for 0-index
                field: err.path.join('.'),
                message: err.message,
                data: record,
              })
            })
          } else {
            logger.error(`❌ [CSV-PARSER] Row ${index + 2} error:`, error)
            result.errors.push({
              row: index + 2,
              message: error instanceof Error ? error.message : 'Unknown error',
              data: record,
            })
          }
        }
      })

      result.success = result.validCount > 0

      logger.info(`🎉 [CSV-PARSER] Parsing completed! Valid: ${result.validCount}, Errors: ${result.errorCount}`)

      return result

    } catch (error) {
      logger.error('❌ [CSV-PARSER] Critical parsing error:', error)

      result.errors.push({
        row: 0,
        message: error instanceof Error ? error.message : 'Failed to parse CSV file',
      })

      return result
    }
  }

  /**
   * Validate CSV structure without full parsing
   */
  async validateCSVStructure(fileBuffer: Buffer): Promise<{
    valid: boolean
    error?: string
    headers?: string[]
  }> {
    try {
      logger.info('🔍 [CSV-PARSER] Starting CSV structure validation...')
      logger.info(`📏 [CSV-PARSER] Buffer size: ${fileBuffer.length} bytes`)

      const records = parse(fileBuffer, {
        columns: true,
        to_line: 2, // Read header + first data row
        skip_empty_lines: true,
        trim: true,
        bom: true,
      })

      logger.info(`📊 [CSV-PARSER] Parsed ${records.length} records for validation`)

      if (records.length === 0) {
        logger.error('❌ [CSV-PARSER] CSV file is empty (no data rows)')
        return {
          valid: false,
          error: 'CSV file is empty',
        }
      }

      const headers = Object.keys(records[0])
      logger.info(`📋 [CSV-PARSER] Found headers: ${headers.join(', ')}`)

      const requiredHeaders = [
        'รหัสสินค้า',
        'ชื่อสินค้า',
        'ราคา',
        'ขาย',
        'ชื่อร้านค้า',
        'อัตราค่าคอมมิชชัน',
        'คอมมิชชัน',
        'ลิงก์สินค้า',
        'ลิงก์ข้อเสนอ',
      ]

      const missingHeaders = requiredHeaders.filter(
        (header) => !headers.includes(header)
      )

      if (missingHeaders.length > 0) {
        logger.error(`❌ [CSV-PARSER] Missing required headers: ${missingHeaders.join(', ')}`)
        return {
          valid: false,
          error: `Missing required headers: ${missingHeaders.join(', ')}`,
          headers,
        }
      }

      logger.info('✅ [CSV-PARSER] CSV structure validation passed')
      return {
        valid: true,
        headers,
      }

    } catch (error) {
      logger.error('❌ [CSV-PARSER] CSV structure validation error:', error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid CSV format',
      }
    }
  }
}

export default new CSVParserService()
