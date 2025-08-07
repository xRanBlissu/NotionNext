import BLOG from '@/blog.config'

let notionAPI = null

// UUID验证函数 - 标准UUID格式验证
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false
  
  // 移除连字符进行长度检查
  const cleanStr = str.replace(/-/g, '')
  if (cleanStr.length !== 32) return false
  
  // 标准UUID格式: 8-4-4-4-12
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

async function getNotionAPI() {
  if (notionAPI) return notionAPI

  console.log('环境变量检查:')
  console.log('- NOTION_INTEGRATION_TOKEN:', process.env.NOTION_INTEGRATION_TOKEN ? 'SET' : 'NOT SET')
  console.log('- BLOG.USE_OFFICIAL_API:', BLOG.USE_OFFICIAL_API)

  // 如果配置了官方API Token，使用官方SDK
  if (BLOG.USE_OFFICIAL_API && process.env.NOTION_INTEGRATION_TOKEN) {
    console.log('使用官方Notion API')
    
    // 动态导入官方SDK（需要先安装 @notionhq/client）
    try {
      const { Client } = await import('@notionhq/client')
      const officialClient = new Client({
        auth: process.env.NOTION_INTEGRATION_TOKEN,
      })
      
      // 创建兼容旧API的包装器
      notionAPI = {
        // 为了兼容旧代码，添加一些包装方法
        getPage: async (pageId) => {
          try {
            // 检查pageId是否为有效的UUID格式
            if (!isValidUUID(pageId)) {
              console.log(`PageId "${pageId}" 不是有效的UUID，回退到旧API`)
              
              // 特殊处理虚拟错误页面
              if (pageId === 'oops-page-001') {
                console.log('检测到虚拟错误页面，返回空数据')
                return null
              }
              
              const legacyAPI = await getLegacyNotionAPI()
              return await legacyAPI.getPage(pageId)
            }

            // 首先尝试作为数据库查询
            try {
              const databaseResponse = await officialClient.databases.query({
                database_id: pageId,
                page_size: 100
              })
              return convertDatabaseToLegacyFormat(databaseResponse, pageId)
            } catch (dbError) {
              // 如果不是数据库，则作为页面处理
              if (dbError.code === 'validation_error' && !dbError.message.includes('is a database')) {
                // 尝试作为页面获取
                const pageRecord = await officialClient.pages.retrieve({ page_id: pageId })
                
                // 获取页面的块内容
                const blocksResponse = await officialClient.blocks.children.list({ 
                  block_id: pageId,
                  page_size: 100 
                })
                
                // 递归获取所有子块
                const allBlocks = await getAllBlocks(officialClient, blocksResponse.results)
                
                // 转换为旧格式的数据结构
                return convertPageToLegacyFormat(pageRecord, allBlocks, pageId)
              }
              
              // 如果是其他错误，重新抛出
              throw dbError
            }
          } catch (error) {
            console.error('官方API获取页面失败:', error)
            throw error
          }
        },

        getBlocks: async (blockIds) => {
          try {
            // 检查是否包含虚拟页面ID
            if (blockIds.includes('oops-page-001')) {
              console.log('检测到虚拟错误页面的block请求，返回空数据')
              return { recordMap: { block: {} } }
            }

            const blocks = {}
            for (const blockId of blockIds) {
              if (!isValidUUID(blockId)) {
                console.log(`BlockId "${blockId}" 不是有效的UUID，跳过`)
                continue
              }
              const blockList = await officialClient.blocks.children.list({
                block_id: blockId,
                page_size: 100
              })
              blocks[blockId] = blockList
            }
            return { recordMap: { block: blocks } }
          } catch (error) {
            console.error('官方API获取块失败:', error)
            throw error
          }
        }
      }

    } catch (error) {
      console.error('官方Notion SDK未安装，回退到非官方API:', error)
      notionAPI = await getLegacyNotionAPI()
    }
  } else {
    console.log('使用非官方Notion API (notion-client)')
    notionAPI = await getLegacyNotionAPI()
  }

  return notionAPI
}

async function getLegacyNotionAPI() {
  const { NotionAPI } = await import('notion-client')
  return new NotionAPI({
    activeUser: BLOG.NOTION_ACTIVE_USER || null,
    authToken: BLOG.NOTION_TOKEN_V2 || null,
    userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
}

// 递归获取所有子块
async function getAllBlocks(client, blocks) {
  const allBlocks = []
  
  for (const block of blocks) {
    allBlocks.push(block)
    
    // 如果块有子项，递归获取
    if (block.has_children) {
      try {
        const childrenResponse = await client.blocks.children.list({
          block_id: block.id,
          page_size: 100
        })
        const children = await getAllBlocks(client, childrenResponse.results)
        allBlocks.push(...children)
      } catch (error) {
        console.warn('获取子块失败:', error)
      }
    }
  }
  
  return allBlocks
}

// 将数据库响应转换为旧格式
function convertDatabaseToLegacyFormat(databaseResponse, databaseId) {
  const blocks = {}
  const collection = {}
  const collectionQuery = {}
  const collectionView = {}
  
  // 创建数据库根页面
  blocks[databaseId] = {
    value: {
      id: databaseId,
      type: 'collection_view_page',
      collection_id: databaseId,
      view_ids: ['default_view'],
      properties: {
        title: [[databaseResponse.results[0]?.parent?.database_id || 'Database']]
      }
    }
  }
  
  // 转换每个页面
  const pageIds = []
  databaseResponse.results.forEach(page => {
    pageIds.push(page.id)
    blocks[page.id] = {
      value: {
        id: page.id,
        type: 'page',
        parent_id: databaseId,
        parent_table: 'collection',
        properties: convertPropertiesToLegacy(page.properties),
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        format: page.cover ? { 
          page_cover: page.cover.external?.url || page.cover.file?.url 
        } : {}
      }
    }
  })
  
  // 创建collection
  collection[databaseId] = {
    value: {
      id: databaseId,
      name: [['Database']],
      schema: generateSchema(databaseResponse.results),
      icon: '📄',
      parent_id: databaseId,
      parent_table: 'space'
    }
  }
  
  // 创建collection view
  collectionView['default_view'] = {
    value: {
      id: 'default_view',
      type: 'table',
      name: 'Default View',
      parent_id: databaseId,
      parent_table: 'collection'
    }
  }
  
  // 创建collection query
  collectionQuery[databaseId] = {
    default_view: {
      collection_group_results: {
        blockIds: pageIds
      },
      blockIds: pageIds
    }
  }
  
  return {
    block: blocks,
    collection,
    collection_view: collectionView,
    collection_query: collectionQuery,
    recordMap: {
      block: blocks,
      collection,
      collection_view: collectionView
    }
  }
}

// 将页面转换为旧格式
function convertPageToLegacyFormat(pageRecord, allBlocks, pageId) {
  const blocks = {}
  
  // 添加主页面
  blocks[pageId] = {
    value: {
      id: pageId,
      type: 'page',
      properties: convertPropertiesToLegacy(pageRecord.properties || {}),
      created_time: pageRecord.created_time,
      last_edited_time: pageRecord.last_edited_time,
      format: pageRecord.cover ? {
        page_cover: pageRecord.cover.external?.url || pageRecord.cover.file?.url
      } : {},
      content: allBlocks.map(block => block.id)
    }
  }
  
  // 添加所有子块
  allBlocks.forEach(block => {
    blocks[block.id] = {
      value: convertBlockToLegacy(block)
    }
  })
  
  return {
    block: blocks,
    recordMap: {
      block: blocks
    }
  }
}

// 转换属性格式
function convertPropertiesToLegacy(properties) {
  const legacyProps = {}
  
  Object.entries(properties).forEach(([key, prop]) => {
    switch (prop.type) {
      case 'title':
        legacyProps.title = prop.title.map(t => [t.plain_text])
        break
      case 'rich_text':
        legacyProps[key] = prop.rich_text.map(t => [t.plain_text])
        break
      case 'select':
        legacyProps[key] = prop.select ? [[prop.select.name]] : []
        break
      case 'multi_select':
        legacyProps[key] = prop.multi_select.map(s => [s.name])
        break
      case 'date':
        legacyProps[key] = prop.date ? [[prop.date.start]] : []
        break
      case 'checkbox':
        legacyProps[key] = [[prop.checkbox ? 'Yes' : 'No']]
        break
      case 'number':
        legacyProps[key] = prop.number !== null ? [[prop.number.toString()]] : []
        break
      case 'url':
        legacyProps[key] = prop.url ? [[prop.url]] : []
        break
      case 'email':
        legacyProps[key] = prop.email ? [[prop.email]] : []
        break
      case 'phone_number':
        legacyProps[key] = prop.phone_number ? [[prop.phone_number]] : []
        break
      case 'status':
        legacyProps[key] = prop.status ? [[prop.status.name]] : []
        break
      default:
        legacyProps[key] = [['']]
    }
  })
  
  return legacyProps
}

// 生成数据库schema
function generateSchema(pages) {
  const schema = {}
  
  if (pages.length > 0) {
    const samplePage = pages[0]
    Object.entries(samplePage.properties).forEach(([key, prop]) => {
      schema[key] = {
        name: key,
        type: prop.type,
        options: prop.type === 'select' && prop.select ? [prop.select] : 
                prop.type === 'multi_select' ? prop.multi_select : []
      }
    })
  }
  
  return schema
}

// 转换块格式
function convertBlockToLegacy(block) {
  return {
    id: block.id,
    type: block.type,
    properties: {},
    created_time: block.created_time,
    last_edited_time: block.last_edited_time,
    parent_id: block.parent?.page_id || block.parent?.block_id,
    parent_table: 'block',
    alive: true,
    content: block.has_children ? [] : undefined,
    // 保留原始的官方API数据用于渲染
    notion_block: block
  }
}

export default getNotionAPI
