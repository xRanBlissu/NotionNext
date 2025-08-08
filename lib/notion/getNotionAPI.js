import BLOG from '@/blog.config'
import { Client } from '@notionhq/client'

// UUID验证函数
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false
  
  // 移除连字符进行长度检查
  const cleanStr = str.replace(/-/g, '')
  if (cleanStr.length !== 32) return false
  
  // 检查是否只包含hex字符
  if (!/^[0-9a-f]{32}$/i.test(cleanStr)) return false
  
  // 标准UUID格式: 8-4-4-4-12，或者Notion的32位hex字符串
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const notionIdRegex = /^[0-9a-f]{32}$/i
  
  return uuidRegex.test(str) || notionIdRegex.test(cleanStr)
}

// 清理和验证UUID
function cleanAndValidateUUID(id) {
  if (!id) return null
  
  // 移除所有非字母数字和连字符的字符
  const cleaned = id.replace(/[^a-f0-9-]/gi, '')
  
  // 检查是否是有效的UUID格式
  if (isValidUUID(cleaned)) {
    return cleaned
  }
  
  // 如果不是有效UUID，尝试从字符串中提取UUID
  const uuidMatch = cleaned.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i)
  if (uuidMatch) {
    const extracted = uuidMatch[0]
    // 确保UUID格式正确（添加连字符）
    const formatted = extracted.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, '$1-$2-$3-$4-$5')
    if (isValidUUID(formatted)) {
      return formatted
    }
  }
  
  return null
}

// 官方API客户端
let officialNotionClient = null

function getOfficialNotionClient() {
  if (!officialNotionClient && BLOG.NOTION_INTEGRATION_TOKEN) {
    officialNotionClient = new Client({
      auth: BLOG.NOTION_INTEGRATION_TOKEN,
    })
  }
  return officialNotionClient
}

// 将官方API数据转换为legacy格式
function convertDatabaseToLegacyFormat(results) {
  const converted = {
    block: {},
    collection: {},
    collection_view: {},
    notion_user: {},
    space: {},
    signed_urls: {}
  }

  // 创建虚拟collection对象
  const collectionId = BLOG.NOTION_DATABASE_ID || 'default-collection'
  converted.collection[collectionId] = {
    value: {
      id: collectionId,
      name: [['Y1WangRan Notion 博客']],
      schema: {
        title: { name: 'Name', type: 'title' },
        type: { name: 'Type', type: 'select' },
        status: { name: 'Status', type: 'select' },
        date: { name: 'Date', type: 'date' },
        tags: { name: 'Tags', type: 'multi_select' },
        category: { name: 'Category', type: 'select' },
        summary: { name: 'Summary', type: 'text' },
        slug: { name: 'Slug', type: 'text' }
      }
    }
  }

  // 转换每个页面
  results.forEach(page => {
    const blockId = page.id.replace(/-/g, '')
    
    // 提取属性值
    const properties = page.properties
    const title = properties.title?.title?.[0]?.text?.content || ''
    const type = properties.type?.select?.name || 'Post'
    const status = properties.status?.select?.name || 'Published'
    const date = properties.date?.date?.start || new Date().toISOString()
    const tags = properties.tags?.multi_select?.map(tag => tag.name) || []
    const category = properties.category?.select?.name || ''
    const summary = properties.summary?.rich_text?.[0]?.text?.content || ''
    const slug = properties.slug?.rich_text?.[0]?.text?.content || ''

    converted.block[blockId] = {
      value: {
        id: blockId,
        type: 'page',
        properties: {
          title: [[title]],
          type: [[type]],
          status: [[status]],
          date: [[date]],
          tags: tags.length > 0 ? [tags.join(',')] : [[]],
          category: [[category]],
          summary: [[summary]],
          slug: [[slug]]
        },
        content: [],
        created_time: new Date(page.created_time).getTime(),
        last_edited_time: new Date(page.last_edited_time).getTime(),
        parent_id: collectionId,
        parent_table: 'collection',
        alive: true,
        cover: page.cover?.external?.url || page.cover?.file?.url,
        icon: page.icon?.emoji || page.icon?.external?.url || page.icon?.file?.url,
        format: {
          page_cover: page.cover?.external?.url || page.cover?.file?.url,
          page_icon: page.icon?.emoji || page.icon?.external?.url || page.icon?.file?.url
        }
      }
    }
  })

  return converted
}

let notionAPI = null

async function getNotionAPI() {
  if (notionAPI) return notionAPI

  console.log('环境变量检查:')
  console.log('- NOTION_INTEGRATION_TOKEN:', process.env.NOTION_INTEGRATION_TOKEN ? 'SET' : 'NOT SET')
  console.log('- NOTION_DATABASE_ID:', BLOG.NOTION_DATABASE_ID ? 'SET' : 'NOT SET')

  const client = getOfficialNotionClient()
  
  if (!client || !BLOG.NOTION_DATABASE_ID) {
    throw new Error('Official Notion API not configured. Please set NOTION_INTEGRATION_TOKEN and NOTION_DATABASE_ID.')
  }

  notionAPI = {
    getPage: async (pageId) => {
      console.log(`[官方API] 处理页面ID: ${pageId}`)
      
      // 特殊处理虚拟错误页面
      if (pageId === 'oops-page-001') {
        console.log('检测到虚拟错误页面，返回空数据')
        return {
          block: {},
          collection: {},
          collection_view: {},
          notion_user: {},
          space: {},
          signed_urls: {}
        }
      }
      
      const cleanedPageId = cleanAndValidateUUID(pageId)
      if (!cleanedPageId) {
        console.log(`PageId "${pageId}" 不是有效的UUID，返回空数据`)
        return {
          block: {},
          collection: {},
          collection_view: {},
          notion_user: {},
          space: {},
          signed_urls: {}
        }
      }
      
      try {
        // 首先检查是否是数据库本身
        if (cleanedPageId === BLOG.NOTION_DATABASE_ID) {
          console.log('[官方API] 正在查询数据库页面')
          const response = await client.databases.query({
            database_id: BLOG.NOTION_DATABASE_ID,
            filter: {
              property: 'status',
              select: {
                equals: 'Published'
              }
            },
            page_size: 100
          })
          
          console.log(`[官方API] 数据库查询成功，页面数量: ${response.results.length}`)
          return convertDatabaseToLegacyFormat(response.results)
        }
        
        // 尝试直接获取页面
        try {
          const page = await client.pages.retrieve({ page_id: cleanedPageId })
          console.log(`[官方API] 页面查询成功: ${page.id}`)
          return convertDatabaseToLegacyFormat([page])
        } catch (pageError) {
          console.log(`[官方API] 直接页面查询失败，尝试数据库查询: ${pageError.message}`)
          
          // 从数据库查询页面
          const response = await client.databases.query({
            database_id: BLOG.NOTION_DATABASE_ID,
            filter: {
              property: 'status',
              select: {
                equals: 'Published'
              }
            }
          })
          
          // 查找匹配的页面
          const matchingPage = response.results.find(page => 
            page.id.replace(/-/g, '') === cleanedPageId.replace(/-/g, '')
          )
          
          if (matchingPage) {
            console.log(`[官方API] 在数据库中找到页面: ${matchingPage.id}`)
            return convertDatabaseToLegacyFormat([matchingPage])
          }
          
          console.log(`[官方API] 在数据库中未找到页面，返回空数据`)
          return {
            block: {},
            collection: {},
            collection_view: {},
            notion_user: {},
            space: {},
            signed_urls: {}
          }
        }
        
      } catch (error) {
        console.error(`[官方API] 错误: ${error.message}`)
        
        if (error.code === 'object_not_found') {
          console.log('[官方API] 对象未找到，返回空数据')
          return {
            block: {},
            collection: {},
            collection_view: {},
            notion_user: {},
            space: {},
            signed_urls: {}
          }
        }
        
        throw error
      }
    },
    
    getPageBlocks: async (pageId) => {
      console.log(`[官方API] 获取页面块: ${pageId}`)
      
      const cleanedPageId = cleanAndValidateUUID(pageId)
      if (!cleanedPageId) {
        console.log('无效的页面ID，返回空块列表')
        return []
      }
      
      try {
        const response = await client.blocks.children.list({
          block_id: cleanedPageId,
          page_size: 100
        })
        
        console.log(`[官方API] 获取到 ${response.results.length} 个块`)
        return response.results
      } catch (error) {
        console.error(`[官方API] 获取页面块失败: ${error.message}`)
        if (error.code === 'object_not_found') {
          return []
        }
        throw error
      }
    }
  }

  return notionAPI
}

export default getNotionAPI
