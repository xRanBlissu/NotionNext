import BLOG from '@/blog.config'

/**
 * 使用官方API获取数据库数据
 * @param {string} databaseId 数据库ID
 * @returns {Object} 数据库内容
 */
export async function getNotionDatabase(databaseId) {
  if (!process.env.NOTION_INTEGRATION_TOKEN) {
    console.error('NOTION_INTEGRATION_TOKEN 未配置')
    return null
  }

  try {
    const { Client } = require('@notionhq/client')
    const notion = new Client({
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    })

    // 查询数据库
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'status',
        select: {
          equals: 'Published'
        }
      },
      sorts: [
        {
          property: 'date',
          direction: 'descending'
        }
      ]
    })

    // 转换为兼容格式
    return convertDatabaseToLegacyFormat(response)
  } catch (error) {
    console.error('获取Notion数据库失败:', error)
    throw error
  }
}

/**
 * 将官方API的数据库响应转换为旧格式
 * @param {Object} response 官方API响应
 * @returns {Object} 转换后的数据
 */
function convertDatabaseToLegacyFormat(response) {
  const pages = {}
  const collection = {}
  const collectionQuery = {}
  const collectionView = {}

  // 转换页面数据
  response.results.forEach(page => {
    pages[page.id] = {
      value: {
        id: page.id,
        type: 'page',
        properties: convertPropertiesToLegacyFormat(page.properties),
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        format: page.cover ? { 
          page_cover: page.cover.external?.url || page.cover.file?.url 
        } : {}
      }
    }
  })

  // 创建模拟的collection数据
  const collectionId = `collection_${Date.now()}`
  const viewId = `view_${Date.now()}`
  
  collection[collectionId] = {
    value: {
      id: collectionId,
      name: [['Database']],
      schema: getSchemaFromPages(response.results)
    }
  }

  collectionView[viewId] = {
    value: {
      id: viewId,
      type: 'table',
      name: 'Default View'
    }
  }

  collectionQuery[collectionId] = {
    [viewId]: {
      collection_group_results: {
        blockIds: response.results.map(page => page.id)
      },
      blockIds: response.results.map(page => page.id)
    }
  }

  return {
    block: pages,
    collection,
    collection_view: collectionView,
    collection_query: collectionQuery,
    recordMap: {
      block: pages,
      collection,
      collection_view: collectionView
    }
  }
}

/**
 * 转换属性格式
 * @param {Object} properties 官方API属性
 * @returns {Object} 转换后的属性
 */
function convertPropertiesToLegacyFormat(properties) {
  const converted = {}

  for (const [key, value] of Object.entries(properties)) {
    switch (value.type) {
      case 'title':
        converted.title = value.title.map(text => [text.plain_text])
        break
      case 'rich_text':
        converted[key] = value.rich_text.map(text => [text.plain_text])
        break
      case 'select':
        converted[key] = value.select ? [[value.select.name]] : []
        break
      case 'multi_select':
        converted[key] = value.multi_select.map(option => [option.name])
        break
      case 'date':
        converted[key] = value.date ? [[value.date.start]] : []
        break
      case 'checkbox':
        converted[key] = [[value.checkbox.toString()]]
        break
      case 'number':
        converted[key] = value.number ? [[value.number.toString()]] : []
        break
      case 'url':
        converted[key] = value.url ? [[value.url]] : []
        break
      case 'email':
        converted[key] = value.email ? [[value.email]] : []
        break
      case 'phone_number':
        converted[key] = value.phone_number ? [[value.phone_number]] : []
        break
      default:
        converted[key] = [['']]
    }
  }

  return converted
}

/**
 * 从页面生成数据库模式
 * @param {Array} pages 页面列表
 * @returns {Object} 数据库模式
 */
function getSchemaFromPages(pages) {
  const schema = {}
  
  if (pages.length > 0) {
    const firstPage = pages[0]
    for (const [key, value] of Object.entries(firstPage.properties)) {
      schema[key] = {
        name: key,
        type: value.type
      }
    }
  }

  return schema
}