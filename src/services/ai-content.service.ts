import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import config from '@config/env'
import logger from '@utils/logger'
import { IProduct, IAIContent } from '@models/product.model'

export interface GenerateContentOptions {
  tone?: 'casual' | 'professional' | 'enthusiastic' | 'friendly'
  style?: 'short' | 'medium' | 'detailed'
  language?: 'th' | 'en'
}

export class AIContentService {
  private openai?: OpenAI
  private anthropic?: Anthropic

  constructor() {
    // Initialize AI clients based on config
    if (config.ai.provider === 'openai' && config.ai.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.ai.openai.apiKey,
      })
      logger.info('OpenAI client initialized')
    }

    if (config.ai.provider === 'anthropic' && config.ai.anthropic.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.ai.anthropic.apiKey,
      })
      logger.info('Anthropic client initialized')
    }

    if (!this.openai && !this.anthropic) {
      logger.warn('No AI provider configured. AI content generation will not be available.')
    }
  }

  /**
   * Generate marketing content for a product
   */
  async generateContent(
    product: IProduct,
    options: GenerateContentOptions = {}
  ): Promise<IAIContent> {
    const {
      tone = 'enthusiastic',
      style = 'medium',
      language = 'th',
    } = options

    const prompt = this.buildPrompt(product, { tone, style, language })

    try {
      let response: string

      if (config.ai.provider === 'openai' && this.openai) {
        response = await this.generateWithOpenAI(prompt)
      } else if (config.ai.provider === 'anthropic' && this.anthropic) {
        response = await this.generateWithAnthropic(prompt)
      } else {
        throw new Error('No AI provider available')
      }

      // Parse JSON response
      const content = this.parseAIResponse(response)

      logger.info(`AI content generated for product: ${product.productId}`)

      return content

    } catch (error) {
      logger.error('AI content generation failed:', error)
      throw error
    }
  }

  /**
   * Build prompt for AI
   */
  private buildPrompt(
    product: IProduct,
    options: GenerateContentOptions
  ): string {
    const { tone, style, language } = options

    const toneDescriptions = {
      casual: 'เป็นกันเอง สบายๆ',
      professional: 'เป็นมืออาชีพ น่าเชื่อถือ',
      enthusiastic: 'กระตือรือร้น น่าตื่นเต้น',
      friendly: 'เป็นมิตร อบอุ่น',
    }

    const styleDescriptions = {
      short: '50-80 คำ กระชับ ตรงประเด็น',
      medium: '80-120 คำ พอเหมาะ มีรายละเอียดพอสมควร',
      detailed: '120-150 คำ ละเอียด ครบถ้วน',
    }

    return `คุณเป็นนักเขียนคอนเทนต์มืออาชีพที่เชี่ยวชาญด้านการตลาดออนไลน์และ Shopee Affiliate

ข้อมูลสินค้า:
- ชื่อสินค้า: ${product.name}
- ราคา: ${product.price} บาท
- ร้านค้า: ${product.shopName}
- ยอดขาย: ${product.salesCount}
- ค่าคอมมิชชัน: ${product.commission} บาท (${product.commissionRate})
- ลิงก์: ${product.affiliateUrl}

คำแนะนำ:
- น้ำเสียง: ${toneDescriptions[tone!]}
- รูปแบบ: ${styleDescriptions[style!]}
- ภาษา: ภาษาไทย
- เหมาะสำหรับวิดีโอสั้น 15-30 วินาที (TikTok/Shopee)

กรุณาสร้างคอนเทนต์ที่มีคุณภาพโดยมีองค์ประกอบดังนี้:

1. **Caption** (${styleDescriptions[style!]}):
   - เขียน caption ที่ดึงดูดความสนใจ เน้นประโยชน์ของสินค้า
   - ใช้ emoji ที่เหมาะสม (2-4 ตัว)
   - สร้างความเร่งด่วน (limited time, bestseller, etc.)
   - จบด้วย call-to-action ที่ชัดเจน

2. **Hashtags** (10-15 แท็ก):
   - แท็กเฉพาะสินค้า (brand, product type)
   - แท็กหมวดหมู่
   - แท็กทั่วไป (#ของดี #ราคาถูก #ช้อปปี้)
   - แท็กที่กำลังฮิต

3. **Description** (2-3 ประโยค):
   - อธิบายสินค้าอย่างละเอียด
   - เน้นจุดเด่นและประโยชน์
   - เหมาะสำหรับใช้เป็น voiceover

4. **Key Points** (3-5 จุด):
   - จุดเด่นสำคัญของสินค้าที่จะแสดงใน text overlay
   - กระชับ ชัดเจน อ่านง่าย
   - แต่ละจุดไม่เกิน 10 คำ

5. **Target Audience** (1 ประโยค):
   - ระบุกลุ่มเป้าหมายที่เหมาะสม

6. **Video Hook** (1 ประโยค สั้น):
   - ประโยคเปิดหัวที่ดึงดูด สำหรับ 3 วินาทีแรก
   - ทำให้คนอยากดูต่อ

ตอบกลับในรูปแบบ JSON เท่านั้น:
{
  "caption": "...",
  "hashtags": ["...", "..."],
  "description": "...",
  "keyPoints": ["...", "...", "..."],
  "targetAudience": "...",
  "videoHook": "..."
}

ห้ามใส่ข้อความอื่นนอกจาก JSON`
  }

  /**
   * Generate with OpenAI
   */
  private async generateWithOpenAI(prompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized')
    }

    const response = await this.openai.chat.completions.create({
      model: config.ai.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional Thai e-commerce content creator. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenAI')
    }

    return content
  }

  /**
   * Generate with Anthropic Claude
   */
  private async generateWithAnthropic(prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized')
    }

    const response = await this.anthropic.messages.create({
      model: config.ai.anthropic.model,
      max_tokens: 2048,
      temperature: 0.8,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.content[0]

    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic')
    }

    return content.text
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(response: string): IAIContent {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : response

      const parsed = JSON.parse(jsonStr)

      // Validate required fields
      if (!parsed.caption || !parsed.hashtags || !parsed.description) {
        throw new Error('Missing required fields in AI response')
      }

      return {
        caption: parsed.caption,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        description: parsed.description,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        targetAudience: parsed.targetAudience || 'ผู้บริโภคทั่วไป',
        videoHook: parsed.videoHook,
      }

    } catch (error) {
      logger.error('Failed to parse AI response:', error)
      logger.debug('Raw response:', response)
      throw new Error('Failed to parse AI response')
    }
  }
}

export default new AIContentService()
