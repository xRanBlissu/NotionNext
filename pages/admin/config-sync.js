import { useState } from 'react'
import Head from 'next/head'

/**
 * 配置同步管理页面
 * 用于手动清理配置缓存，实现动态配置更新
 */
export default function ConfigSync() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')

  const handleClearConfigCache = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clearConfig'
        })
      })
      
      const result = await response.json()
      
      if (result.status === 'success') {
        setMessage(`✅ ${result.message}`)
        setMessageType('success')
        // 3秒后刷新页面以加载新配置
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } else {
        setMessage(`❌ ${result.message}`)
        setMessageType('error')
      }
    } catch (error) {
      setMessage(`❌ 操作失败: ${error.message}`)
      setMessageType('error')
    }
    
    setLoading(false)
  }

  const handleClearAllCache = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clearAll'
        })
      })
      
      const result = await response.json()
      
      if (result.status === 'success') {
        setMessage(`✅ ${result.message}`)
        setMessageType('success')
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } else {
        setMessage(`❌ ${result.message}`)
        setMessageType('error')
      }
    } catch (error) {
      setMessage(`❌ 操作失败: ${error.message}`)
      setMessageType('error')
    }
    
    setLoading(false)
  }

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '50px auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <Head>
        <title>配置同步管理 - NotionNext</title>
      </Head>
      
      <h1 style={{ 
        textAlign: 'center', 
        color: '#333',
        marginBottom: '30px'
      }}>
        🔄 配置同步管理
      </h1>
      
      <div style={{ 
        background: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '30px'
      }}>
        <h3>使用说明</h3>
        <p>当您在 Notion 配置中心页面修改配置后，点击下方按钮清理缓存，网站将在下次访问时自动加载新配置。</p>
        <p><strong>建议操作流程：</strong></p>
        <ol>
          <li>在 Notion 中修改配置中心页面的配置项</li>
          <li>返回此页面，点击"清理配置缓存"</li>
          <li>等待3秒后页面自动刷新，新配置即可生效</li>
        </ol>
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px',
        marginBottom: '30px'
      }}>
        <button
          onClick={handleClearConfigCache}
          disabled={loading}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? '⏳ 处理中...' : '🔄 清理配置缓存（推荐）'}
        </button>
        
        <button
          onClick={handleClearAllCache}
          disabled={loading}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            backgroundColor: '#ff4757',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? '⏳ 处理中...' : '🗑️ 清理全部缓存'}
        </button>
      </div>
      
      {message && (
        <div style={{
          padding: '15px',
          borderRadius: '5px',
          backgroundColor: messageType === 'success' ? '#d4edda' : '#f8d7da',
          border: `1px solid ${messageType === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          color: messageType === 'success' ? '#155724' : '#721c24',
          textAlign: 'center'
        }}>
          {message}
          {messageType === 'success' && (
            <div style={{ marginTop: '10px', fontSize: '14px' }}>
              页面将在 3 秒后自动刷新...
            </div>
          )}
        </div>
      )}
      
      <div style={{ 
        marginTop: '40px', 
        padding: '15px', 
        background: '#e3f2fd', 
        borderRadius: '5px',
        fontSize: '14px'
      }}>
        <strong>💡 小贴士：</strong>
        <ul style={{ margin: '10px 0 0 20px' }}>
          <li>配置缓存：只清理配置相关缓存，页面加载更快</li>
          <li>全部缓存：清理所有缓存，包括文章内容，首次加载会较慢</li>
          <li>建议收藏此页面，方便随时同步配置</li>
        </ul>
      </div>
    </div>
  )
}