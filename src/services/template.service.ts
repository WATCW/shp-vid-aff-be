import Template, { ITemplate } from '@models/template.model'
import logger from '@utils/logger'

export interface TemplateFilters {
  category?: string
  isPremium?: boolean
  isActive?: boolean
  search?: string
}

export interface TemplateListOptions {
  page?: number
  limit?: number
  sortBy?: 'name' | 'usageCount' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export class TemplateService {
  /**
   * Get all templates with optional filters and pagination
   */
  async getTemplates(
    filters: TemplateFilters = {},
    options: TemplateListOptions = {}
  ) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options

      // Build query
      const query: any = {}

      if (filters.category) {
        query.category = filters.category
      }

      if (filters.isPremium !== undefined) {
        query.isPremium = filters.isPremium
      }

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive
      } else {
        // Default to active templates only
        query.isActive = true
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
        ]
      }

      // Execute query with pagination
      const skip = (page - 1) * limit
      const sortDirection = sortOrder === 'asc' ? 1 : -1

      const [templates, total] = await Promise.all([
        Template.find(query)
          .sort({ [sortBy]: sortDirection })
          .skip(skip)
          .limit(limit)
          .lean(),
        Template.countDocuments(query),
      ])

      return {
        templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting templates:', error)
      throw new Error('Failed to fetch templates')
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(id: string) {
    try {
      const template = await Template.findById(id).lean()

      if (!template) {
        throw new Error('Template not found')
      }

      return template
    } catch (error) {
      logger.error('Error getting template by ID:', error)
      throw error
    }
  }

  /**
   * Get a template by name
   */
  async getTemplateByName(name: string) {
    try {
      const template = await Template.findOne({ name }).lean()

      if (!template) {
        throw new Error('Template not found')
      }

      return template
    } catch (error) {
      logger.error('Error getting template by name:', error)
      throw error
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string) {
    try {
      const templates = await Template.find({
        category,
        isActive: true,
      })
        .sort({ usageCount: -1 })
        .lean()

      return templates
    } catch (error) {
      logger.error('Error getting templates by category:', error)
      throw new Error('Failed to fetch templates by category')
    }
  }

  /**
   * Get most popular templates
   */
  async getPopularTemplates(limit: number = 10) {
    try {
      const templates = await Template.find({ isActive: true })
        .sort({ usageCount: -1 })
        .limit(limit)
        .lean()

      return templates
    } catch (error) {
      logger.error('Error getting popular templates:', error)
      throw new Error('Failed to fetch popular templates')
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(templateData: Partial<ITemplate>) {
    try {
      const template = new Template(templateData)
      await template.save()

      logger.info(`Template created: ${template.name}`)
      return template
    } catch (error) {
      logger.error('Error creating template:', error)
      throw new Error('Failed to create template')
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, updateData: Partial<ITemplate>) {
    try {
      const template = await Template.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )

      if (!template) {
        throw new Error('Template not found')
      }

      logger.info(`Template updated: ${template.name}`)
      return template
    } catch (error) {
      logger.error('Error updating template:', error)
      throw error
    }
  }

  /**
   * Delete a template (soft delete by setting isActive to false)
   */
  async deleteTemplate(id: string) {
    try {
      const template = await Template.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      )

      if (!template) {
        throw new Error('Template not found')
      }

      logger.info(`Template deleted: ${template.name}`)
      return template
    } catch (error) {
      logger.error('Error deleting template:', error)
      throw error
    }
  }

  /**
   * Increment usage count for a template
   */
  async incrementUsage(id: string) {
    try {
      const template = await Template.findByIdAndUpdate(
        id,
        { $inc: { usageCount: 1 } },
        { new: true }
      )

      if (!template) {
        throw new Error('Template not found')
      }

      return template
    } catch (error) {
      logger.error('Error incrementing template usage:', error)
      throw error
    }
  }

  /**
   * Get template categories with counts
   */
  async getCategories() {
    try {
      const categories = await Template.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            templates: { $push: { id: '$_id', name: '$name' } },
          },
        },
        { $sort: { count: -1 } },
      ])

      return categories.map((cat) => ({
        category: cat._id,
        count: cat.count,
        templates: cat.templates,
      }))
    } catch (error) {
      logger.error('Error getting template categories:', error)
      throw new Error('Failed to fetch template categories')
    }
  }

  /**
   * Get template stats
   */
  async getStats() {
    try {
      const [total, active, premium, categories] = await Promise.all([
        Template.countDocuments(),
        Template.countDocuments({ isActive: true }),
        Template.countDocuments({ isPremium: true, isActive: true }),
        this.getCategories(),
      ])

      return {
        total,
        active,
        premium,
        free: active - premium,
        categories,
      }
    } catch (error) {
      logger.error('Error getting template stats:', error)
      throw new Error('Failed to fetch template stats')
    }
  }
}

export default new TemplateService()
