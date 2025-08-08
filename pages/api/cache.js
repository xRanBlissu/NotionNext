import { cleanCache } from '@/lib/cache/local_file_cache'
import { delCacheData, getApi } from '@/lib/cache/cache_manager'

/**
 * 缓存管理API
 * 支持清理全部缓存或指定配置缓存
 * @param {*} req
 * @param {*} res
 */
export default async function handler(req, res) {
  try {
    const { method, query, body } = req
    
    if (method === 'POST') {
      const { action, cacheKey } = body
      
      if (action === 'clearConfig') {
        // 清理配置相关缓存
        const configCacheKeys = [
          'site_data_', // 主要配置缓存
          'page_content_' // 页面内容缓存（包含配置页面）
        ]
        
        const cacheApi = getApi()
        let clearedKeys = []
        
        // 如果指定了特定的缓存键，只清理该键
        if (cacheKey) {
          await delCacheData(cacheKey)
          clearedKeys.push(cacheKey)
        } else {
          // 清理所有配置相关缓存
          for (const keyPrefix of configCacheKeys) {
            // 这里简化处理，实际应该遍历所有匹配的键
            const possibleKeys = [
              `${keyPrefix}246494da-eda8-80af-9603-c6a0e1e1213d`, // 您的数据库ID
            ]
            
            for (const key of possibleKeys) {
              try {
                await delCacheData(key)
                clearedKeys.push(key)
              } catch (error) {
                console.log('Cache key not found:', key)
              }
            }
          }
        }
        
        res.status(200).json({ 
          status: 'success', 
          message: 'Configuration cache cleared successfully!',
          clearedKeys,
          note: 'Configuration will be refreshed on next page load'
        })
      } else if (action === 'clearAll') {
        await cleanCache()
        res.status(200).json({ status: 'success', message: 'All cache cleared successfully!' })
      } else {
        res.status(400).json({ status: 'error', message: 'Invalid action' })
      }
    } else if (method === 'GET') {
      // 兼容旧的GET请求，清理全部缓存
      await cleanCache()
      res.status(200).json({ status: 'success', message: 'Clean cache successful!' })
    } else {
      res.status(405).json({ status: 'error', message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Cache operation failed:', error)
    res.status(400).json({ 
      status: 'error', 
      message: 'Cache operation failed!', 
      error: error.message 
    })
  }
}
