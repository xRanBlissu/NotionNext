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

    // 查询数据库（不使用硬编码的过滤条件）
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100
      // 移除硬编码的过滤和排序，让系统动态处理
    })

    // 转换为兼容格式
    return convertDatabaseToLegacyFormat(response, databaseId)
  } catch (error) {
    console.error('获取Notion数据库失败:', error)
    throw error
  }
}

/**
 * 将官方API的数据库响应转换为旧格式
 * @param {Object} response 官方API响应
 * @param {string} databaseId 数据库ID
 * @returns {Object} 转换后的数据
 */
function convertDatabaseToLegacyFormat(response, databaseId) {
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
        title: [['Database']]
      }
    }
  }
  
  // 转换每个页面
  const pageIds = []
  response.results.forEach(page => {
    pageIds.push(page.id)
    blocks[page.id] = {
      value: {
        id: page.id,
        type: 'page',
        parent_id: databaseId,
        parent_table: 'collection',
        properties: convertPropertiesToLegacyFormat(page.properties),
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
      schema: getSchemaFromPages(response.results),
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
        converted[key] = [[value.checkbox ? 'Yes' : 'No']]
        break
      case 'number':
        converted[key] = value.number !== null ? [[value.number.toString()]] : []
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
      case 'status':
        converted[key] = value.status ? [[value.status.name]] : []
        break
      case 'files':
        converted[key] = value.files.map(file => [file.name || file.external?.url || file.file?.url || ''])
        break
      case 'people':
        converted[key] = value.people.map(person => [person.name || person.id])
        break
      case 'relation':
        converted[key] = value.relation.map(rel => [rel.id])
        break
      case 'rollup':
        // Rollup 的处理比较复杂，简化处理
        if (value.rollup.type === 'array') {
          converted[key] = value.rollup.array.map(item => [item.toString()])
        } else {
          converted[key] = [[value.rollup[value.rollup.type]?.toString() || '']]
        }
        break
      case 'formula':
        // Formula 的处理也比较复杂
        const formulaValue = value.formula[value.formula.type]
        converted[key] = [[formulaValue?.toString() || '']]
        break
      case 'created_time':
        converted[key] = [[value.created_time]]
        break
      case 'last_edited_time':
        converted[key] = [[value.last_edited_time]]
        break
      case 'created_by':
        converted[key] = [[value.created_by.name || value.created_by.id]]
        break
      case 'last_edited_by':
        converted[key] = [[value.last_edited_by.name || value.last_edited_by.id]]
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