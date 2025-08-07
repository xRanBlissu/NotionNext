import BLOG from "@/blog.config"
import { getNotionDatabase } from "./getNotionData"

export default async function getAllPageIds (collectionQuery, collectionId, collectionView, viewIds) {
  // 如果使用官方API且配置了数据库ID
  if (BLOG.USE_OFFICIAL_API && BLOG.NOTION_PAGE_ID) {
    try {
      console.log('使用官方API获取页面ID列表')
      const databaseData = await getNotionDatabase(BLOG.NOTION_PAGE_ID)
      if (databaseData && databaseData.recordMap && databaseData.recordMap.block) {
        const pageIds = Object.keys(databaseData.recordMap.block)
        console.log('官方API获取到页面数量:', pageIds.length)
        return pageIds
      }
    } catch (error) {
      console.error('官方API获取页面ID失败，回退到旧API:', error)
    }
  }

  // 回退到旧的实现
  if (!collectionQuery && !collectionView) {
    return []
  }
  let pageIds = []
  try {
    // Notion数据库中的第几个视图用于站点展示和排序：
    const groupIndex = BLOG.NOTION_INDEX || 0
    if (viewIds && viewIds.length > 0) {
      const ids = collectionQuery[collectionId][viewIds[groupIndex]]?.collection_group_results?.blockIds || []
      for (const id of ids) {
        pageIds.push(id)
      }
    }
  } catch (error) {
    console.error('Error fetching page IDs:', error);
    return [];
  }

  // 否则按照数据库原始排序
  if (pageIds.length === 0 && collectionQuery && Object.values(collectionQuery).length > 0) {
    const pageSet = new Set()
    Object.values(collectionQuery[collectionId]).forEach(view => {
      view?.blockIds?.forEach(id => pageSet.add(id)) // group视图
      view?.collection_group_results?.blockIds?.forEach(id => pageSet.add(id)) // table视图
    })
    pageIds = [...pageSet]
    // console.log('PageIds: 从collectionQuery获取', collectionQuery, pageIds.length)
  }
  return pageIds
}
