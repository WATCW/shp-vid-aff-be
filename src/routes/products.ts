import { Elysia, t } from 'elysia'
import { Product } from '@models/product.model'
import logger from '@utils/logger'

export const productRoutes = new Elysia({ prefix: '/products' })
  /**
   * Get all products with pagination and filters
   */
  .get(
    '/',
    async ({ query }) => {
      try {
        const {
          page = '1',
          limit = '50',
          status,
          shopName,
          search,
          sortBy = 'uploadedAt',
          sortOrder = 'desc',
        } = query

        const pageNum = parseInt(page)
        const limitNum = parseInt(limit)
        const skip = (pageNum - 1) * limitNum

        // Build filter
        const filter: any = {}

        if (status) {
          filter.status = status
        }

        if (shopName) {
          filter.shopName = shopName
        }

        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { productId: { $regex: search, $options: 'i' } },
          ]
        }

        // Build sort
        const sort: any = {}
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1

        // Execute query
        const [products, total] = await Promise.all([
          Product.find(filter)
            .sort(sort)
            .limit(limitNum)
            .skip(skip)
            .lean(),
          Product.countDocuments(filter),
        ])

        return {
          success: true,
          data: products,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            hasMore: pageNum * limitNum < total,
          },
        }

      } catch (error) {
        logger.error('Failed to fetch products:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch products',
        }
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
        shopName: t.Optional(t.String()),
        search: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Products'],
        summary: 'List products',
        description: 'Get paginated list of products with optional filters',
      },
    }
  )

  /**
   * Get product by ID
   */
  .get(
    '/:id',
    async ({ params }) => {
      try {
        const product = await Product.findById(params.id).lean()

        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          }
        }

        return {
          success: true,
          data: product,
        }

      } catch (error) {
        logger.error('Failed to fetch product:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch product',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Products'],
        summary: 'Get product by ID',
      },
    }
  )

  /**
   * Update product
   */
  .patch(
    '/:id',
    async ({ params, body }) => {
      try {
        const product = await Product.findByIdAndUpdate(
          params.id,
          { $set: body },
          { new: true, runValidators: true }
        )

        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          }
        }

        logger.info(`Product updated: ${params.id}`)

        return {
          success: true,
          data: product,
        }

      } catch (error) {
        logger.error('Failed to update product:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update product',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        status: t.Optional(t.String()),
        aiContent: t.Optional(t.Object({
          caption: t.String(),
          hashtags: t.Array(t.String()),
          description: t.String(),
          keyPoints: t.Array(t.String()),
          targetAudience: t.String(),
          videoHook: t.Optional(t.String()),
        })),
      }),
      detail: {
        tags: ['Products'],
        summary: 'Update product',
      },
    }
  )

  /**
   * Delete product
   */
  .delete(
    '/:id',
    async ({ params }) => {
      try {
        const product = await Product.findByIdAndDelete(params.id)

        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          }
        }

        logger.info(`Product deleted: ${params.id}`)

        return {
          success: true,
          message: 'Product deleted successfully',
        }

      } catch (error) {
        logger.error('Failed to delete product:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete product',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Products'],
        summary: 'Delete product',
      },
    }
  )

  /**
   * Get product statistics
   */
  .get(
    '/stats/overview',
    async () => {
      try {
        const stats = await Product.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ])

        const totalProducts = await Product.countDocuments()
        const totalCommission = await Product.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: '$commission' },
            },
          },
        ])

        const statusMap = stats.reduce((acc, item) => {
          acc[item._id] = item.count
          return acc
        }, {} as Record<string, number>)

        return {
          success: true,
          data: {
            total: totalProducts,
            byStatus: statusMap,
            totalCommission: totalCommission[0]?.total || 0,
          },
        }

      } catch (error) {
        logger.error('Failed to fetch stats:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch stats',
        }
      }
    },
    {
      detail: {
        tags: ['Products'],
        summary: 'Get product statistics',
      },
    }
  )
