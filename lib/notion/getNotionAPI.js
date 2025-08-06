import BLOG from '@/blog.config'

let notionAPI = null

async function getNotionAPI() {
  if (notionAPI) return notionAPI

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
            // 使用官方API获取页面
            const page = await officialClient.pages.retrieve({ page_id: pageId })
            const blocksResponse = await officialClient.blocks.children.list({ 
              block_id: pageId,
              page_size: 100 
            })
            
            // 转换为旧格式的数据结构
            return convertOfficialToLegacyFormat(page, blocksResponse)
          } catch (error) {
            console.error('官方API获取页面失败:', error)
            throw error
          }
        },

        getBlocks: async (blockIds) => {
          try {
            const blocks = {}
            for (const blockId of blockIds) {
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

// 将官方API格式转换为旧格式，保持兼容性
function convertOfficialToLegacyFormat(page, blocksResponse) {
  // 这里需要根据具体需求转换数据格式
  // 暂时返回一个基础的转换结果
  return {
    block: {
      [page.id]: {
        value: {
          id: page.id,
          type: 'page',
          properties: {
            title: page.properties?.title?.title || page.properties?.Name?.title || []
          },
          created_time: page.created_time,
          last_edited_time: page.last_edited_time,
          format: page.cover ? { page_cover: page.cover.external?.url || page.cover.file?.url } : {}
        }
      }
    }
  }
}

export default getNotionAPI
