/**
 * OneAPI服务 - 独立版本
 */

const axios = require('axios');

class OneApiService {
  constructor() {
    this.baseUrl = process.env.ONEAPI_BASE_URL || 'http://104.194.9.201:11002';
    this.apiKey = process.env.ONEAPI_KEY || 't0bAXxyETOitEfEWuU37sWSqwJrE';
  }

  /**
   * 获取请求头
   */
  getHeaders() {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cache-Control': 'no-store',
      'New-API-User': '1',
      'Proxy-Connection': 'keep-alive',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'X-Forwarded-Host': '104.194.9.201:11002',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  /**
   * 获取所有渠道（分页获取）- 流式版本
   */
  async getAllChannelsStream(onProgress = null) {
    try {
      console.log('🌍 Starting to fetch all channels with pagination');
      let allChannels = [];
      let page = 1;
      const pageSize = 100;

      if (onProgress) {
        onProgress({
          type: 'fetch_start',
          message: '开始获取渠道数据...',
          page: 0,
          totalChannels: 0
        });
      }

      while (true) {
        console.log(`🌍 Fetching page ${page}`);

        if (onProgress) {
          onProgress({
            type: 'fetch_page',
            message: `正在获取第 ${page} 页数据...`,
            page: page,
            totalChannels: allChannels.length
          });
        }

        const queryParams = new URLSearchParams({
          p: page,
          page_size: pageSize,
          id_sort: true,
          tag_mode: false
        });

        const response = await axios.get(
          `${this.baseUrl}/api/channel/?${queryParams}`,
          {
            headers: this.getHeaders(),
            timeout: 30000
          }
        );

        if (!response.data || !response.data.success) {
          console.error(`Failed to fetch page ${page}:`, response.data?.message || 'Unknown error');
          if (onProgress) {
            onProgress({
              type: 'fetch_error',
              message: `获取第 ${page} 页失败: ${response.data?.message || 'Unknown error'}`,
              page: page,
              totalChannels: allChannels.length
            });
          }
          break;
        }

        const pageData = response.data.data;
        if (!pageData || !pageData.items || pageData.items.length === 0) {
          console.log(`🌍 Page ${page}: no more channels, stopping pagination`);
          if (onProgress) {
            onProgress({
              type: 'fetch_complete',
              message: `获取完成，共 ${page - 1} 页，${allChannels.length} 个渠道`,
              page: page - 1,
              totalChannels: allChannels.length
            });
          }
          break;
        }

        console.log(`🌍 Page ${page}: got ${pageData.items.length} channels, total so far: ${allChannels.length + pageData.items.length}`);
        allChannels = allChannels.concat(pageData.items);

        if (onProgress) {
          onProgress({
            type: 'fetch_progress',
            message: `已获取第 ${page} 页，累计 ${allChannels.length} 个渠道`,
            page: page,
            totalChannels: allChannels.length,
            currentPageChannels: pageData.items.length
          });
        }

        page++;

        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`🌍 Successfully fetched all ${allChannels.length} channels across ${page - 1} pages`);

      if (onProgress) {
        onProgress({
          type: 'fetch_complete',
          message: `数据获取完成！共 ${allChannels.length} 个渠道`,
          page: page - 1,
          totalChannels: allChannels.length
        });
      }

      return {
        success: true,
        data: {
          items: allChannels
        }
      };

    } catch (error) {
      console.error('Error fetching all channels:', error.message);
      if (onProgress) {
        onProgress({
          type: 'fetch_error',
          message: `获取渠道数据失败: ${error.message}`,
          error: error.message
        });
      }
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取所有渠道（分页获取）- 兼容非流式版本
   */
  async getAllChannels() {
    return this.getAllChannelsStream(null);
  }
}

module.exports = new OneApiService();