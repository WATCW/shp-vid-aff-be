import { Elysia, t } from 'elysia'
import templateService from '@services/template.service'
import logger from '@utils/logger'

export const templateRoutes = new Elysia({ prefix: '/templates' })
  /**
   * Get all templates with pagination and filters
   */
  .get(
    '/',
    async ({ query }) => {
      try {
        const {
          page,
          limit,
          category,
          isPremium,
          search,
          sortBy,
          sortOrder,
        } = query

        const filters = {
          category,
          isPremium: isPremium ? isPremium === 'true' : undefined,
          search,
        }

        const options = {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          sortBy,
          sortOrder,
        }

        const result = await templateService.getTemplates(filters, options)

        return {
          success: true,
          data: result.templates,
          pagination: result.pagination,
        }
      } catch (error: any) {
        logger.error('Error getting templates:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch templates',
        }
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        category: t.Optional(t.String()),
        isPremium: t.Optional(t.String()),
        search: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Get a single template by ID
   */
  .get(
    '/:id',
    async ({ params }) => {
      try {
        const template = await templateService.getTemplateById(params.id)

        return {
          success: true,
          data: template,
        }
      } catch (error: any) {
        logger.error('Error getting template:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch template',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  /**
   * Get templates by category
   */
  .get(
    '/category/:category',
    async ({ params }) => {
      try {
        const templates = await templateService.getTemplatesByCategory(params.category)

        return {
          success: true,
          data: templates,
        }
      } catch (error: any) {
        logger.error('Error getting templates by category:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch templates',
        }
      }
    },
    {
      params: t.Object({
        category: t.String(),
      }),
    }
  )

  /**
   * Get popular templates
   */
  .get(
    '/popular/:limit',
    async ({ params }) => {
      try {
        const limit = parseInt(params.limit) || 10
        const templates = await templateService.getPopularTemplates(limit)

        return {
          success: true,
          data: templates,
        }
      } catch (error: any) {
        logger.error('Error getting popular templates:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch popular templates',
        }
      }
    },
    {
      params: t.Object({
        limit: t.String(),
      }),
    }
  )

  /**
   * Get template categories
   */
  .get(
    '/meta/categories',
    async () => {
      try {
        const categories = await templateService.getCategories()

        return {
          success: true,
          data: categories,
        }
      } catch (error: any) {
        logger.error('Error getting template categories:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch categories',
        }
      }
    }
  )

  /**
   * Get template statistics
   */
  .get(
    '/stats/overview',
    async () => {
      try {
        const stats = await templateService.getStats()

        return {
          success: true,
          data: stats,
        }
      } catch (error: any) {
        logger.error('Error getting template stats:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch template stats',
        }
      }
    }
  )

  /**
   * Create a new template (Admin only)
   */
  .post(
    '/',
    async ({ body }) => {
      try {
        const template = await templateService.createTemplate(body)

        return {
          success: true,
          message: 'Template created successfully',
          data: template,
        }
      } catch (error: any) {
        logger.error('Error creating template:', error)
        return {
          success: false,
          error: error.message || 'Failed to create template',
        }
      }
    },
    {
      body: t.Any(), // We'll add proper validation later
    }
  )

  /**
   * Update a template (Admin only)
   */
  .patch(
    '/:id',
    async ({ params, body }) => {
      try {
        const template = await templateService.updateTemplate(params.id, body)

        return {
          success: true,
          message: 'Template updated successfully',
          data: template,
        }
      } catch (error: any) {
        logger.error('Error updating template:', error)
        return {
          success: false,
          error: error.message || 'Failed to update template',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Any(),
    }
  )

  /**
   * Delete a template (Admin only)
   */
  .delete(
    '/:id',
    async ({ params }) => {
      try {
        await templateService.deleteTemplate(params.id)

        return {
          success: true,
          message: 'Template deleted successfully',
        }
      } catch (error: any) {
        logger.error('Error deleting template:', error)
        return {
          success: false,
          error: error.message || 'Failed to delete template',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )
