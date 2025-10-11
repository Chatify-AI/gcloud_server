import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Box,
  CircularProgress,
  Avatar,
  Switch,
  FormControlLabel,
  Tooltip,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Card,
  CardContent,
  Grid
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Cloud as CloudIcon,
  History as HistoryIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
  Search as SearchIcon,
  AttachMoney as MoneyIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  FilterAlt as FilterIcon,
  Clear as ClearIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Sync as SyncIcon,
  DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material'
import axios from 'axios'
import { toast } from 'react-toastify'

function GCloudAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [authId, setAuthId] = useState('') // Store authId from backend
  const [editAccount, setEditAccount] = useState(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [generatingUrl, setGeneratingUrl] = useState(false)
  const [monitorLogsDialogOpen, setMonitorLogsDialogOpen] = useState(false)
  const [selectedAccountLogs, setSelectedAccountLogs] = useState(null)
  const [monitorLogs, setMonitorLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [executionCountDialog, setExecutionCountDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [tempExecutionCount, setTempExecutionCount] = useState(0)
  const [testDetailsDialog, setTestDetailsDialog] = useState(false)
  const [selectedTestDetails, setSelectedTestDetails] = useState(null)

  // 分页和搜索相关状态
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 0,
    showAll: false
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // 时间筛选相关状态
  const [dateFilter, setDateFilter] = useState({
    createdFrom: '',
    createdTo: ''
  })

  // 消费数据相关状态
  const [consumptionData, setConsumptionData] = useState({})
  const [loadingConsumption, setLoadingConsumption] = useState({})

  // 全选功能相关状态
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [allSelected, setAllSelected] = useState(false)

  // 批量操作相关状态
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [operationProgress, setOperationProgress] = useState(null)

  // 统计数据计算
  const statistics = useMemo(() => {
    const totalAccounts = accounts.length
    let totalAmount = 0
    let accountsWithData = 0

    accounts.forEach(account => {
      const consumption = consumptionData[account.id]
      if (consumption?.success && consumption.data?.totalAmount) {
        totalAmount += consumption.data.totalAmount
        accountsWithData++
      }
    })

    const accountsWithoutData = totalAccounts - accountsWithData
    const averageAmount = totalAccounts > 0 ? totalAmount / totalAccounts : 0
    const averageAmountWithData = accountsWithData > 0 ? totalAmount / accountsWithData : 0

    return {
      totalAccounts,
      totalAmount,
      averageAmount,
      averageAmountWithData,
      accountsWithData,
      accountsWithoutData
    }
  }, [accounts, consumptionData])

  useEffect(() => {
    fetchAccounts()
  }, [pagination.page, pagination.pageSize, pagination.showAll, searchTerm])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        showAll: pagination.showAll,
        search: searchTerm,
        createdFrom: dateFilter.createdFrom,
        createdTo: dateFilter.createdTo
      }

      const response = await axios.get('/api/gcloud-accounts', { params })
      setAccounts(response.data.accounts)
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }))

      // 自动异步获取消费数据
      if (response.data.accounts && response.data.accounts.length > 0) {
        fetchConsumptionData(response.data.accounts)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('获取Google Cloud账户失败')
    } finally {
      setLoading(false)
    }
  }

  // 单个账户获取消费数据（带重试）
  const fetchSingleConsumption = async (accountId, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(`/api/gcloud-accounts/${accountId}/consumption`)

        if (response.data.success) {
          return {
            accountId,
            success: true,
            data: response.data.consumption,
            message: response.data.message
          }
        } else {
          if (attempt === retries) {
            return {
              accountId,
              success: false,
              error: response.data.message || 'Failed to fetch consumption',
              message: response.data.message
            }
          }
          // 等待1秒后重试
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.warn(`Attempt ${attempt}/${retries} failed for account ${accountId}:`, error.message)
        if (attempt === retries) {
          return {
            accountId,
            success: false,
            error: error.message || 'Network error',
            message: 'Failed to fetch consumption data'
          }
        }
        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  const fetchConsumptionData = async (accountList) => {
    const accountIds = accountList.map(acc => acc.id)

    // 设置加载状态
    const loadingState = {}
    accountIds.forEach(id => {
      loadingState[id] = true
    })
    setLoadingConsumption(loadingState)

    // 批量并发获取消费数据
    const fetchPromises = accountIds.map(async (accountId) => {
      try {
        console.log(`Fetching consumption data for account ${accountId}...`)
        const result = await fetchSingleConsumption(accountId)

        // 更新单个账户的消费数据
        setConsumptionData(prev => ({
          ...prev,
          [accountId]: {
            success: result.success,
            data: result.data,
            error: result.error,
            message: result.message
          }
        }))

        // 清除该账户的加载状态
        setLoadingConsumption(prev => {
          const newState = { ...prev }
          delete newState[accountId]
          return newState
        })

        return { accountId, success: true }
      } catch (error) {
        console.error(`Error fetching consumption for account ${accountId}:`, error)

        // 设置错误状态
        setConsumptionData(prev => ({
          ...prev,
          [accountId]: {
            success: false,
            error: error.message,
            message: 'Failed to fetch consumption data'
          }
        }))

        // 清除该账户的加载状态
        setLoadingConsumption(prev => {
          const newState = { ...prev }
          delete newState[accountId]
          return newState
        })

        return { accountId, success: false, error: error.message }
      }
    })

    // 等待所有请求完成
    try {
      const results = await Promise.allSettled(fetchPromises)
      console.log('All consumption data fetch completed:', results)
    } catch (error) {
      console.error('Error in batch consumption fetch:', error)
    }
  }

  const handleSearch = () => {
    setSearchTerm(searchInput)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({ ...prev, [field]: value }))
  }

  const handleApplyDateFilter = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchAccounts()
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setSearchTerm('')
    setDateFilter({ createdFrom: '', createdTo: '' })
    setPagination(prev => ({ ...prev, page: 1 }))

    // 立即应用重置
    setTimeout(() => {
      fetchAccounts()
    }, 0)
  }

  const handleQuickDateFilter = (days) => {
    const today = new Date()
    const startDate = new Date()

    if (days === 0) {
      // 今天
      startDate.setHours(0, 0, 0, 0)
      today.setHours(23, 59, 59, 999)
    } else {
      // 最近N天
      startDate.setDate(today.getDate() - days + 1)
      startDate.setHours(0, 0, 0, 0)
      today.setHours(23, 59, 59, 999)
    }

    const fromDateStr = startDate.toISOString().split('T')[0]
    const toDateStr = today.toISOString().split('T')[0]

    setDateFilter({
      createdFrom: fromDateStr,
      createdTo: toDateStr
    })
    setPagination(prev => ({ ...prev, page: 1 }))

    // 立即应用筛选
    setTimeout(() => {
      fetchAccounts()
    }, 0)
  }

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch()
    }
  }

  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handlePageSizeChange = (event) => {
    const newPageSize = event.target.value
    const showAll = newPageSize === 'all'
    setPagination(prev => ({
      ...prev,
      pageSize: showAll ? 100 : newPageSize,
      showAll,
      page: 1
    }))
  }

  const handleGenerateAuthUrl = async () => {
    setGeneratingUrl(true)
    try {
      const response = await axios.get('/api/gcloud-accounts/auth-url')
      setAuthUrl(response.data.authUrl)
      setAuthId(response.data.authId) // Store the authId
      setDialogOpen(true)
      toast.info('请复制授权链接并在新标签页中打开')
    } catch (error) {
      console.error('Error generating auth URL:', error)
      toast.error('生成授权链接失败')
    } finally {
      setGeneratingUrl(false)
    }
  }

  const handleAddAccount = async () => {
    if (!authCode.trim()) {
      toast.error('请输入授权码')
      return
    }

    setAddingAccount(true)
    try {
      const response = await axios.post('/api/gcloud-accounts/add', {
        code: authCode.trim(),
        authId: authId
      })

      if (response.data.success) {
        toast.success('Google Cloud账户添加成功!')
        setDialogOpen(false)
        setAuthCode('')
        setAuthUrl('')
        setAuthId('')
        await fetchAccounts()
      } else {
        toast.error(response.data.message || '添加账户失败')
      }
    } catch (error) {
      console.error('Error adding account:', error)
      toast.error(error.response?.data?.error || '添加账户失败')
    } finally {
      setAddingAccount(false)
    }
  }

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('确定要删除这个账户吗？')) {
      return
    }

    try {
      await axios.delete(`/api/gcloud-accounts/${accountId}`)
      toast.success('账户删除成功')
      fetchAccounts()
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('删除账户失败')
    }
  }

  const handleRefreshAccount = async (accountId) => {
    try {
      await axios.post(`/api/gcloud-accounts/${accountId}/refresh`)
      toast.success('账户令牌刷新成功')
      fetchAccounts()
    } catch (error) {
      console.error('Error refreshing account:', error)
      toast.error('刷新令牌失败')
    }
  }

  const handleToggleMonitoring = async (accountId, needMonitor) => {
    try {
      await axios.put(`/api/gcloud-accounts/${accountId}/monitor`, {
        needMonitor: !needMonitor
      })
      toast.success(`监听已${!needMonitor ? '开启' : '关闭'}`)

      // 只更新本地状态，不重新获取消费数据
      setAccounts(prev => prev.map(account =>
        account.id === accountId
          ? { ...account, needMonitor: !needMonitor }
          : account
      ))
    } catch (error) {
      console.error('Error toggling monitoring:', error)
      toast.error('切换监听状态失败')
    }
  }

  const handleEditExecutionCount = (account) => {
    setEditingAccount(account)
    setTempExecutionCount(account.scriptExecutionCount || 0)
    setExecutionCountDialog(true)
  }

  const handleSaveExecutionCount = async () => {
    try {
      await axios.put(
        `/api/gcloud-accounts/${editingAccount.id}/execution-count`,
        { scriptExecutionCount: parseInt(tempExecutionCount) }
      )
      setExecutionCountDialog(false)
      toast.success('执行次数更新成功')

      // 只更新本地状态，不重新获取消费数据
      setAccounts(prev => prev.map(account =>
        account.id === editingAccount.id
          ? { ...account, scriptExecutionCount: parseInt(tempExecutionCount) }
          : account
      ))

      setEditingAccount(null)
    } catch (error) {
      console.error('Error updating execution count:', error)
      toast.error('更新执行次数失败')
    }
  }


  const handleViewMonitorLogs = async (account) => {
    setSelectedAccountLogs(account)
    setMonitorLogsDialogOpen(true)
    setLogsLoading(true)

    try {
      const response = await axios.get(`/api/gcloud-accounts/${account.id}/monitor-logs`)
      setMonitorLogs(response.data.logs || [])
    } catch (error) {
      console.error('Error fetching monitor logs:', error)
      toast.error('获取监听日志失败')
    } finally {
      setLogsLoading(false)
    }
  }

  const handleEditAccount = (account) => {
    setEditAccount(account)
    setEditDialogOpen(true)
  }

  const handleUpdateAccount = async () => {
    try {
      await axios.put(`/api/gcloud-accounts/${editAccount.id}`, editAccount)
      toast.success('账户更新成功')
      setEditDialogOpen(false)
      fetchAccounts()
    } catch (error) {
      console.error('Error updating account:', error)
      toast.error('更新账户失败')
    }
  }

  const renderConsumptionCell = (account) => {
    const consumption = consumptionData[account.id]
    const isLoading = loadingConsumption[account.id]

    if (isLoading) {
      return (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={16} />
          <Typography variant="caption">Loading...</Typography>
        </Box>
      )
    }

    if (!consumption) {
      return (
        <Typography variant="caption" color="text.secondary">
          No data
        </Typography>
      )
    }

    if (!consumption.success) {
      return (
        <Tooltip title={consumption.error || consumption.message || 'Failed to load'}>
          <Typography variant="caption" color="error">
            Error
          </Typography>
        </Tooltip>
      )
    }

    if (consumption.data) {
      const amount = consumption.data.totalAmount || 0
      return (
        <Box display="flex" flexDirection="column" alignItems="flex-start" gap={0.2}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <MoneyIcon fontSize="small" color="primary" />
            <Typography variant="body2" fontWeight="medium" color="primary" sx={{ fontSize: '0.85rem' }}>
              ${amount.toFixed(4)}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', ml: 2.5 }}>
            {consumption.data.totalChannels} 个渠道
          </Typography>
        </Box>
      )
    }

    return (
      <Typography variant="caption" color="text.secondary">
        No consumption
      </Typography>
    )
  }

  const handleViewTestDetails = (testDetails) => {
    setSelectedTestDetails(testDetails)
    setTestDetailsDialog(true)
  }

  // 全选功能 - 只选择未监听的账户
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedAccounts([])
      setAllSelected(false)
    } else {
      // 只选择未监听的账户
      const unmonitoredIds = accounts
        .filter(acc => !acc.needMonitor)
        .map(acc => acc.id);

      setSelectedAccounts(unmonitoredIds)
      setAllSelected(unmonitoredIds.length === accounts.length)
    }
  }

  const handleSelectAccount = (accountId) => {
    // 检查该账户是否为未监听状态
    const account = accounts.find(acc => acc.id === accountId);

    // 只允许选择未监听的账户
    if (account && account.needMonitor) {
      toast.warning('只能选择未监听的账户');
      return;
    }

    setSelectedAccounts(prev => {
      if (prev.includes(accountId)) {
        const newSelected = prev.filter(id => id !== accountId)
        setAllSelected(false)
        return newSelected
      } else {
        const newSelected = [...prev, accountId]
        const unmonitoredCount = accounts.filter(acc => !acc.needMonitor).length;
        setAllSelected(newSelected.length === unmonitoredCount)
        return newSelected
      }
    })
  }

  // 自动选择未监听的账号
  const handleSelectUnmonitored = () => {
    const unmonitoredIds = accounts
      .filter(acc => !acc.needMonitor)
      .map(acc => acc.id)
    setSelectedAccounts(unmonitoredIds)
    const totalUnmonitored = accounts.filter(acc => !acc.needMonitor).length;
    setAllSelected(unmonitoredIds.length === totalUnmonitored && totalUnmonitored === accounts.length)
  }

  // 单个账户同步（带重试）
  const syncSingleAccount = async (accountData, retries = 3) => {
    const accountId = accountData.id

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // 准备完整的账户数据
        const consumption = consumptionData[accountId]
        const accountSyncData = {
          id: accountData.id,
          email: accountData.email,
          consumptionAmount: consumption?.success ? consumption.data?.totalAmount : 0,
          scriptExecutionCount: accountData.scriptExecutionCount,
          createdAt: accountData.createdAt,
          lastMonitorTime: accountData.lastMonitorTime
        }

        const response = await axios.post('/api/gcloud-accounts/batch-sync', {
          accountsData: [accountSyncData]
        })

        if (response.data.success && response.data.results.length > 0) {
          const result = response.data.results[0]

          // 如果成功或者不是"Failed to get channels data"类型的错误，直接返回
          if (result.success || (result.error && !result.error.includes('Failed to get channels data'))) {
            return result
          }

          // 如果是"Failed to get channels data"错误且还有重试机会
          if (attempt < retries && result.error && result.error.includes('Failed to get channels data')) {
            console.warn(`Attempt ${attempt}/${retries} failed for account ${accountId}: ${result.error}`)
            // 等待2秒后重试
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }

          return result
        } else {
          if (attempt === retries) {
            return {
              accountId,
              success: false,
              error: 'Sync API call failed',
              message: response.data.message || 'Unknown error'
            }
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error) {
        console.warn(`Attempt ${attempt}/${retries} failed for account ${accountId}:`, error.message)
        if (attempt === retries) {
          return {
            accountId,
            success: false,
            error: error.message || 'Network error',
            message: 'Failed to sync account'
          }
        }
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  // 批量同步功能（一次性处理）
  const handleBatchSync = async () => {
    if (selectedAccounts.length === 0) {
      toast.error('请选择要同步的账户')
      return
    }

    setSyncing(true)

    try {
      // 准备所有选中账户的完整数据
      const accountsData = selectedAccounts.map(accountId => {
        const account = accounts.find(acc => acc.id === accountId)
        const consumption = consumptionData[accountId]

        return {
          id: account.id,
          email: account.email,
          consumptionAmount: consumption?.success ? consumption.data?.totalAmount : 0,
          scriptExecutionCount: account.scriptExecutionCount,
          createdAt: account.createdAt,
          lastMonitorTime: account.lastMonitorTime
        }
      })

      console.log(`Starting batch sync for ${accountsData.length} accounts...`)

      // 设置进度
      setOperationProgress({
        type: 'sync',
        total: accountsData.length,
        completed: 0,
        failed: 0,
        results: [],
        currentAccount: '准备批量同步...',
        progress: 0
      })

      // 一次性发送所有数据
      const response = await axios.post('/api/gcloud-accounts/batch-sync', {
        accountsData: accountsData
      })

      if (response.data.success) {
        const { results, summary } = response.data

        // 更新最终进度
        setOperationProgress({
          type: 'sync',
          total: summary.total,
          completed: summary.success,
          failed: summary.failed,
          results: results,
          currentAccount: '批量同步完成',
          progress: 100
        })

        if (summary.success > 0) {
          toast.success(`同步完成：成功 ${summary.success} 个，失败 ${summary.failed} 个`)
        } else {
          toast.error(`同步失败：${summary.failed} 个账户都失败了`)
        }

        console.log(`Batch sync completed: ${summary.success}/${summary.total} accounts synced`)
      } else {
        toast.error('批量同步失败')
      }

    } catch (error) {
      console.error('Error in batch sync:', error)
      toast.error(`批量同步过程中出现错误: ${error.message}`)
    } finally {
      setSyncing(false)
      // 保持进度显示3秒后清除
      setTimeout(() => {
        setOperationProgress(null)
      }, 3000)
    }
  }

  // 批量删除渠道功能（流式处理）
  const handleBatchDeleteChannels = async () => {
    if (selectedAccounts.length === 0) {
      toast.error('请选择要删除渠道的账户')
      return
    }

    if (!window.confirm(`确定要删除 ${selectedAccounts.length} 个账户的所有渠道并删除对应的GCloud账户吗？\n\n此操作不可逆！`)) {
      return
    }

    setDeleting(true)

    try {
      // 创建SSE连接
      const response = await fetch('/api/gcloud-accounts/batch-delete-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          accountIds: selectedAccounts
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      const results = []
      let totalDeleted = 0
      let totalFailed = 0

      // 初始化进度
      setOperationProgress({
        type: 'delete',
        total: selectedAccounts.length,
        completed: 0,
        failed: 0,
        results: [],
        currentAccount: '准备删除...',
        progress: 0
      })

      // 读取流数据
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            if (data === '[DONE]') {
              console.log('Stream completed')
              break
            }

            try {
              const event = JSON.parse(data)
              console.log('SSE Event:', event)

              switch (event.type) {
                case 'start':
                  toast.info(event.message)
                  break

                case 'processing':
                  setOperationProgress(prev => ({
                    ...prev,
                    currentAccount: event.email,
                    progress: event.progress || 0,
                    message: event.message
                  }))
                  break

                case 'data_synced':
                  // 数据同步完成
                  setOperationProgress(prev => ({
                    ...prev,
                    message: event.message
                  }))
                  break

                case 'sync_failed':
                  // 数据同步失败但继续删除
                  console.warn('Sync failed:', event.message)
                  break

                case 'channels_processed':
                  // 渠道删除完成的反馈
                  break

                case 'account_deleted':
                  totalDeleted++
                  break

                case 'account_delete_failed':
                case 'account_failed':
                  totalFailed++
                  break

                case 'account_completed':
                  results.push({
                    accountId: event.accountId,
                    email: event.email,
                    channelsDeleted: event.channelsDeleted,
                    channelsFailed: event.channelsFailed,
                    accountDeleted: event.accountDeleted
                  })

                  setOperationProgress(prev => ({
                    ...prev,
                    completed: totalDeleted,
                    failed: totalFailed,
                    results: [...results],
                    currentAccount: event.email,
                    progress: event.progress || 0
                  }))
                  break

                case 'completed':
                  setOperationProgress(prev => ({
                    ...prev,
                    completed: event.summary.deletedAccounts,
                    failed: event.summary.failedAccounts + event.summary.failedChannels,
                    currentAccount: '删除完成',
                    progress: 100,
                    message: event.message
                  }))

                  toast.success(event.message)

                  // 刷新账户列表
                  await fetchAccounts()

                  // 清空选择
                  setSelectedAccounts([])
                  setAllSelected(false)

                  // 3秒后清除进度显示
                  setTimeout(() => {
                    setOperationProgress(null)
                  }, 3000)
                  break

                case 'error':
                  toast.error(event.message)
                  setOperationProgress(prev => ({
                    ...prev,
                    currentAccount: '删除出错',
                    message: event.message
                  }))
                  break
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
            }
          }
        }
      }

    } catch (error) {
      console.error('Error in batch delete:', error)
      toast.error(`批量删除过程中发生错误: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  if (loading && accounts.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Google Cloud 账户管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleGenerateAuthUrl}
          disabled={generatingUrl}
        >
          {generatingUrl ? <CircularProgress size={20} /> : '添加账户'}
        </Button>
      </Box>

      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <AnalyticsIcon color="primary" />
                <Typography variant="h6" color="primary">
                  总账户数
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>
                {statistics.totalAccounts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statistics.accountsWithData} 有数据, {statistics.accountsWithoutData} 无数据
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <MoneyIcon color="success" />
                <Typography variant="h6" color="success.main">
                  累计总金额
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1, color: 'success.main' }}>
                ${statistics.totalAmount.toFixed(4)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                所有账户消费总和
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingUpIcon color="warning" />
                <Typography variant="h6" color="warning.main">
                  平均金额
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1, color: 'warning.main' }}>
                ${statistics.averageAmount.toFixed(4)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                按所有账户计算
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingUpIcon color="info" />
                <Typography variant="h6" color="info.main">
                  有效平均值
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1, color: 'info.main' }}>
                ${statistics.averageAmountWithData.toFixed(4)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                仅计算有消费数据的账户
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 搜索和控制区域 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap" mb={2}>
          <TextField
            placeholder="搜索邮箱、项目ID或项目名称..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            variant="outlined"
            size="small"
            sx={{ minWidth: 300, flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            startIcon={<SearchIcon />}
          >
            搜索
          </Button>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>页面大小</InputLabel>
            <Select
              value={pagination.showAll ? 'all' : pagination.pageSize}
              onChange={handlePageSizeChange}
              label="页面大小"
            >
              <MenuItem value={100}>100条</MenuItem>
              <MenuItem value={200}>200条</MenuItem>
              <MenuItem value="all">全部</MenuItem>
            </Select>
          </FormControl>
          {loading && (
            <CircularProgress size={20} />
          )}
        </Box>

        {/* 时间筛选区域 */}
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={1}>
            <FilterIcon color="action" />
            <Typography variant="body2" color="text.secondary">
              按创建时间筛选:
            </Typography>
          </Box>
          <TextField
            label="开始日期"
            type="date"
            size="small"
            value={dateFilter.createdFrom}
            onChange={(e) => handleDateFilterChange('createdFrom', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ minWidth: 150 }}
          />
          <Typography variant="body2" color="text.secondary">
            至
          </Typography>
          <TextField
            label="结束日期"
            type="date"
            size="small"
            value={dateFilter.createdTo}
            onChange={(e) => handleDateFilterChange('createdTo', e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ minWidth: 150 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleApplyDateFilter}
            startIcon={<FilterIcon />}
            disabled={!dateFilter.createdFrom && !dateFilter.createdTo}
          >
            筛选
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleResetFilters}
            startIcon={<ClearIcon />}
            disabled={!searchTerm && !dateFilter.createdFrom && !dateFilter.createdTo}
          >
            清除筛选
          </Button>
        </Box>

        {/* 快捷时间筛选按钮 */}
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" mt={2}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            快捷筛选:
          </Typography>
          <Button
            variant={dateFilter.createdFrom && dateFilter.createdTo &&
              new Date(dateFilter.createdFrom).toDateString() === new Date().toDateString() ? 'contained' : 'outlined'}
            size="small"
            onClick={() => handleQuickDateFilter(0)}
            sx={{ minWidth: 60 }}
          >
            今天
          </Button>
          {[2, 3, 4, 5, 6, 7].map((days) => (
            <Button
              key={days}
              variant="outlined"
              size="small"
              onClick={() => handleQuickDateFilter(days)}
              sx={{ minWidth: 80 }}
            >
              最近{days}天
            </Button>
          ))}
        </Box>

        {/* 批量操作区域 */}
        {selectedAccounts.length > 0 && (
          <Box display="flex" gap={2} alignItems="center" mt={2} p={2} bgcolor="primary.50" borderRadius={1}>
            <Typography variant="body2" color="primary" fontWeight="medium">
              已选择 {selectedAccounts.length} 个账户
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<SyncIcon />}
              onClick={handleBatchSync}
              disabled={syncing || deleting}
            >
              {syncing ? <CircularProgress size={16} /> : '同步到汇总表'}
            </Button>
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<DeleteSweepIcon />}
              onClick={handleBatchDeleteChannels}
              disabled={syncing || deleting}
            >
              {deleting ? <CircularProgress size={16} /> : '删除渠道+账户'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSelectedAccounts([])
                setAllSelected(false)
              }}
            >
              取消选择
            </Button>
          </Box>
        )}

        {/* 操作进度显示 */}
        {operationProgress && (
          <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
            <Typography variant="h6" gutterBottom>
              {operationProgress.type === 'sync' ? '同步进度' : '删除进度'}
            </Typography>

            {operationProgress.type === 'sync' && (
              <>
                <Typography variant="body2" gutterBottom>
                  总计: {operationProgress.total} 个账户，
                  成功: {operationProgress.completed} 个，
                  失败: {operationProgress.failed} 个
                  {operationProgress.progress && ` (${operationProgress.progress}%)`}
                </Typography>

                {operationProgress.currentAccount && (
                  <Typography variant="body2" color="primary" gutterBottom>
                    当前处理: {operationProgress.currentAccount}
                  </Typography>
                )}

                {syncing && operationProgress.progress && (
                  <Box sx={{ width: '100%', mt: 1, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <Box
                          sx={{
                            width: '100%',
                            height: 8,
                            backgroundColor: 'grey.300',
                            borderRadius: 4,
                            overflow: 'hidden'
                          }}
                        >
                          <Box
                            sx={{
                              width: `${operationProgress.progress}%`,
                              height: '100%',
                              backgroundColor: 'primary.main',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </Box>
                      </Box>
                      <Box sx={{ minWidth: 35 }}>
                        <Typography variant="body2" color="text.secondary">
                          {operationProgress.progress}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              </>
            )}

            {operationProgress.type === 'delete' && (
              <>
                <Typography variant="body2" gutterBottom>
                  总计: {operationProgress.total} 个账户，
                  成功: {operationProgress.completed} 个，
                  失败: {operationProgress.failed} 个
                  {operationProgress.progress && ` (${operationProgress.progress}%)`}
                </Typography>

                {operationProgress.currentAccount && (
                  <Typography variant="body2" color="primary" gutterBottom>
                    当前处理: {operationProgress.currentAccount}
                  </Typography>
                )}

                {operationProgress.message && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {operationProgress.message}
                  </Typography>
                )}

                {deleting && operationProgress.progress !== undefined && (
                  <Box sx={{ width: '100%', mt: 1, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <Box
                          sx={{
                            height: 8,
                            borderRadius: 1,
                            backgroundColor: 'grey.300',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          <Box
                            sx={{
                              width: `${operationProgress.progress}%`,
                              height: '100%',
                              backgroundColor: 'error.main',
                              transition: 'width 0.3s ease-in-out'
                            }}
                          />
                        </Box>
                      </Box>
                      <Box sx={{ minWidth: 35 }}>
                        <Typography variant="body2" color="text.secondary">
                          {operationProgress.progress}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {operationProgress.results && operationProgress.results.length > 0 && (
                  <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="caption" display="block" gutterBottom>
                      处理详情:
                    </Typography>
                    {operationProgress.results.map((result, index) => (
                      <Typography key={index} variant="caption" display="block" sx={{
                        color: result.accountDeleted ? 'success.main' : 'error.main',
                        fontSize: '0.7rem'
                      }}>
                        {result.email}:
                        渠道删除 {result.channelsDeleted}/{result.channelsDeleted + result.channelsFailed}，
                        账户{result.accountDeleted ? '已删除' : '删除失败'}
                      </Typography>
                    ))}
                  </Box>
                )}
              </>
            )}

            {!syncing && !deleting && (
              <Button
                size="small"
                onClick={() => setOperationProgress(null)}
                sx={{ mt: 1 }}
              >
                关闭
              </Button>
            )}
          </Box>
        )}
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '5%', minWidth: 60 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton
                    size="small"
                    onClick={handleSelectAll}
                    color={allSelected ? 'primary' : 'default'}
                  >
                    {allSelected ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                  </IconButton>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSelectUnmonitored}
                    sx={{ fontSize: '0.7rem', padding: '2px 6px' }}
                  >
                    选未监听
                  </Button>
                </Box>
              </TableCell>
              <TableCell sx={{ width: '15%', minWidth: 160 }}>邮箱</TableCell>
              <TableCell sx={{ width: '12%', minWidth: 120 }}>项目信息</TableCell>
              <TableCell sx={{ width: '6%', minWidth: 60 }}>状态</TableCell>
              <TableCell sx={{ width: '10%', minWidth: 100 }}>消费金额</TableCell>
              <TableCell sx={{ width: '10%', minWidth: 100 }}>监听状态</TableCell>
              <TableCell sx={{ width: '8%', minWidth: 80 }}>脚本次数</TableCell>
              <TableCell sx={{ width: '12%', minWidth: 120 }}>创建时间</TableCell>
              <TableCell sx={{ width: '12%', minWidth: 120 }}>上次监听时间</TableCell>
              <TableCell align="right" sx={{ width: '14%', minWidth: 120 }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {searchTerm || dateFilter.createdFrom || dateFilter.createdTo ?
                    '没有找到匹配筛选条件的账户。请尝试调整搜索词或时间范围。' :
                    '没有找到账户。点击"添加账户"来连接您的第一个Google Cloud账户。'
                  }
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell sx={{ padding: '8px' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleSelectAccount(account.id)}
                      color={selectedAccounts.includes(account.id) ? 'primary' : 'default'}
                    >
                      {selectedAccounts.includes(account.id) ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Avatar sx={{ width: 20, height: 20, fontSize: '0.7rem' }}>
                        {account.email?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ overflow: 'hidden' }}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.8rem'
                          }}
                          title={account.email}
                        >
                          {account.email}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: '0.7rem' }}
                        >
                          ID: {account.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ overflow: 'hidden' }}>
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.8rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={account.projectName}
                      >
                        {account.projectName || 'N/A'}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.7rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={account.projectId}
                      >
                        {account.projectId || 'No Project ID'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={account.isActive ? '活跃' : '非活跃'}
                      color={account.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {renderConsumptionCell(account)}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" justifyContent="center">
                      <Switch
                        checked={account.needMonitor || false}
                        onChange={() => handleToggleMonitoring(account.id, account.needMonitor)}
                        size="small"
                        title={account.needMonitor ? '监听已开启' : '监听已关闭'}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={account.scriptExecutionCount || 0}
                        size="small"
                        color={
                          (account.scriptExecutionCount || 0) >= 4
                            ? 'error'
                            : (account.scriptExecutionCount || 0) >= 3
                              ? 'warning'
                              : 'default'
                        }
                        onClick={() => handleEditExecutionCount(account)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        display: 'block'
                      }}
                    >
                      {account.createdAt ? (
                        <>
                          <div>{new Date(account.createdAt).toLocaleDateString()}</div>
                          <div>{new Date(account.createdAt).toLocaleTimeString()}</div>
                        </>
                      ) : (
                        'N/A'
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        display: 'block'
                      }}
                    >
                      {account.lastMonitorTime ? (
                        <>
                          <div>{new Date(account.lastMonitorTime).toLocaleDateString()}</div>
                          <div>{new Date(account.lastMonitorTime).toLocaleTimeString()}</div>
                        </>
                      ) : (
                        '从未监听'
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ padding: '4px 8px' }}>
                    <Box display="flex" gap={0.5} justifyContent="flex-end">
                      <Tooltip title="监听日志">
                        <IconButton
                          size="small"
                          onClick={() => handleViewMonitorLogs(account)}
                          sx={{ padding: '4px' }}
                        >
                          <HistoryIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditAccount(account)}
                          sx={{ padding: '4px' }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="刷新">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleRefreshAccount(account.id)}
                          sx={{ padding: '4px' }}
                        >
                          <RefreshIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAccount(account.id)}
                          sx={{ padding: '4px' }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分页控件 */}
      {!pagination.showAll && pagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" alignItems="center" mt={2} gap={2}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
            size="large"
          />
          <Typography variant="body2" color="text.secondary">
            第 {pagination.page} 页，共 {pagination.totalPages} 页
            (总共 {pagination.total} 个账户)
          </Typography>
        </Box>
      )}

      {/* 添加账户对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加 Google Cloud 账户</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            第一步：点击下面的链接进行授权
          </Typography>

          {authUrl && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                授权链接:
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all', mb: 1 }}>
                {authUrl}
              </Typography>
              <Button
                size="small"
                startIcon={<CopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(authUrl)
                  toast.success('链接已复制到剪贴板!')
                }}
              >
                复制链接
              </Button>
              <Button
                size="small"
                startIcon={<CloudIcon />}
                onClick={() => window.open(authUrl, '_blank')}
                sx={{ ml: 1 }}
              >
                打开链接
              </Button>
            </Paper>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            第二步：完成授权后，将授权码粘贴到下面
          </Typography>

          <TextField
            fullWidth
            label="授权码"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="请粘贴从Google获得的授权码"
            multiline
            rows={2}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleAddAccount}
            variant="contained"
            disabled={!authCode.trim() || addingAccount}
          >
            {addingAccount ? <CircularProgress size={20} /> : '添加账户'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑账户对话框 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑账户信息</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="邮箱地址"
            value={editAccount?.email || ''}
            disabled
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="显示名称"
            value={editAccount?.displayName || ''}
            onChange={(e) => setEditAccount({ ...editAccount, displayName: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="项目ID"
            value={editAccount?.projectId || ''}
            onChange={(e) => setEditAccount({ ...editAccount, projectId: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="项目名称"
            value={editAccount?.projectName || ''}
            onChange={(e) => setEditAccount({ ...editAccount, projectName: e.target.value })}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
          <Button onClick={handleUpdateAccount} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 监听日志对话框 */}
      <Dialog open={monitorLogsDialogOpen} onClose={() => setMonitorLogsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          监听日志 - {selectedAccountLogs?.email}
        </DialogTitle>
        <DialogContent>
          {logsLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>消息</TableCell>
                    <TableCell>渠道信息</TableCell>
                    <TableCell>脚本执行</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monitorLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        暂无监听日志
                      </TableCell>
                    </TableRow>
                  ) : (
                    monitorLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Typography variant="caption">
                            {new Date(log.createdAt).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.monitorStatus}
                            size="small"
                            color={
                              log.monitorStatus === 'success' ? 'success' :
                              log.monitorStatus === 'failed' ? 'error' : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.message}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {log.testDetails && (
                            <Button
                              size="small"
                              onClick={() => handleViewTestDetails(JSON.parse(log.testDetails))}
                            >
                              查看详情 ({log.testedChannels}个渠道)
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.scriptExecuted ? (
                            <Chip
                              label={`已执行 (${log.scriptType})`}
                              size="small"
                              color="primary"
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              未执行
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMonitorLogsDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 测试详情对话框 */}
      <Dialog open={testDetailsDialog} onClose={() => setTestDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>渠道测试详情</DialogTitle>
        <DialogContent>
          {selectedTestDetails && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>渠道ID</TableCell>
                    <TableCell>渠道名称</TableCell>
                    <TableCell>测试结果</TableCell>
                    <TableCell>尝试次数</TableCell>
                    <TableCell>耗时</TableCell>
                    <TableCell>失败原因</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedTestDetails.map((detail, index) => (
                    <TableRow key={index}>
                      <TableCell>{detail.channelId}</TableCell>
                      <TableCell>{detail.channelName}</TableCell>
                      <TableCell>
                        <Chip
                          label={detail.success ? '成功' : '失败'}
                          size="small"
                          color={detail.success ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>{detail.attempts}</TableCell>
                      <TableCell>{detail.totalDuration}ms</TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {detail.reason}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {detail.disabled && (
                          <Chip label="已禁用" size="small" color="warning" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDetailsDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 编辑脚本执行次数对话框 */}
      <Dialog
        open={executionCountDialog}
        onClose={() => setExecutionCountDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          编辑脚本执行次数
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              账户邮箱：{editingAccount?.email}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
              当前执行次数：{editingAccount?.scriptExecutionCount || 0}
            </Typography>
            <TextField
              fullWidth
              label="新的执行次数"
              type="number"
              value={tempExecutionCount}
              onChange={(e) => setTempExecutionCount(e.target.value)}
              inputProps={{ min: 0, max: 10 }}
              helperText="执行次数范围：0-10，≤4执行gemini脚本，>4执行vertex脚本"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExecutionCountDialog(false)}>
            取消
          </Button>
          <Button
            onClick={handleSaveExecutionCount}
            variant="contained"
            color="primary"
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default GCloudAccounts