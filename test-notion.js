const fs = require('fs');

// 手动读取环境变量
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

async function testNotionAPI() {
  console.log('=== Notion API 测试 ===');
  console.log('NOTION_PAGE_ID:', envVars.NOTION_PAGE_ID);
  console.log('NOTION_DATABASE_ID:', envVars.NOTION_DATABASE_ID);
  console.log('NOTION_INTEGRATION_TOKEN:', envVars.NOTION_INTEGRATION_TOKEN ? 'SET' : 'NOT SET');
  
  if (!envVars.NOTION_INTEGRATION_TOKEN) {
    console.log('❌ NOTION_INTEGRATION_TOKEN 未设置');
    return;
  }
  
  const { Client } = await import('@notionhq/client');
  const notion = new Client({
    auth: envVars.NOTION_INTEGRATION_TOKEN,
  });
  
  try {
    console.log('\n=== 测试数据库查询 ===');
    const response = await notion.databases.query({
      database_id: envVars.NOTION_DATABASE_ID,
      page_size: 5
    });
    console.log('✅ 数据库查询成功');
    console.log('页面数量:', response.results.length);
    
    if (response.results.length > 0) {
      console.log('第一页标题:', response.results[0].properties.title?.title[0]?.plain_text || '无标题');
    }
    
  } catch (error) {
    console.log('❌ 数据库查询失败:');
    console.log('错误代码:', error.code);
    console.log('错误消息:', error.message);
  }
  
  try {
    console.log('\n=== 测试页面获取 ===');
    const page = await notion.pages.retrieve({
      page_id: envVars.NOTION_PAGE_ID
    });
    console.log('✅ 页面获取成功');
    console.log('页面标题:', page.properties.title?.title[0]?.plain_text || '无标题');
    
  } catch (error) {
    console.log('❌ 页面获取失败:');
    console.log('错误代码:', error.code);
    console.log('错误消息:', error.message);
  }
}

testNotionAPI().catch(console.error);
