import React, { useState, useEffect, useCallback } from 'react'
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
  InputAdornment
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
  AttachMoney as MoneyIcon
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
    pageSize: 50,
    total: 0,
    totalPages: 0,
    showAll: false
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // 消费数据相关状态
  const [consumptionData, setConsumptionData] = useState({})
  const [loadingConsumption, setLoadingConsumption] = useState({})

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
        search: searchTerm
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

  const fetchConsumptionData = async (accountList) => {
    const accountIds = accountList.map(acc => acc.id)

    // 设置加载状态
    const loadingState = {}
    accountIds.forEach(id => {
      loadingState[id] = true
    })
    setLoadingConsumption(loadingState)

    try {
      const response = await axios.post('/api/gcloud-accounts/batch-consumption', {
        accountIds
      })

      if (response.data.success) {
        const consumptionMap = {}
        response.data.results.forEach(result => {
          consumptionMap[result.accountId] = {
            success: result.success,
            data: result.consumption,
            error: result.error,
            message: result.message
          }
        })
        setConsumptionData(prev => ({ ...prev, ...consumptionMap }))
      }
    } catch (error) {
      console.error('Error fetching consumption data:', error)
    } finally {
      // 清除加载状态
      setLoadingConsumption({})
    }
  }

  const handleSearch = () => {
    setSearchTerm(searchInput)
    setPagination(prev => ({ ...prev, page: 1 }))
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
      pageSize: showAll ? 50 : newPageSize,
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
        authCode: authCode.trim(),
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
        <Box display="flex" alignItems="center" gap={0.5}>
          <MoneyIcon fontSize="small" color="primary" />
          <Typography variant="body2" fontWeight="medium" color="primary">
            ${amount.toFixed(4)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({consumption.data.totalChannels} channels)
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

      {/* 搜索和控制区域 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
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
              <MenuItem value={50}>50条</MenuItem>
              <MenuItem value={100}>100条</MenuItem>
              <MenuItem value="all">全部</MenuItem>
            </Select>
          </FormControl>
          {loading && (
            <CircularProgress size={20} />
          )}
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '20%', minWidth: 180 }}>邮箱</TableCell>
              <TableCell sx={{ width: '15%', minWidth: 120 }}>项目信息</TableCell>
              <TableCell sx={{ width: '8%', minWidth: 60 }}>状态</TableCell>
              <TableCell sx={{ width: '12%', minWidth: 100 }}>消费金额</TableCell>
              <TableCell sx={{ width: '10%', minWidth: 80 }}>监听状态</TableCell>
              <TableCell sx={{ width: '10%', minWidth: 80 }}>脚本次数</TableCell>
              <TableCell sx={{ width: '15%', minWidth: 120 }}>上次监听时间</TableCell>
              <TableCell align="right" sx={{ width: '10%', minWidth: 120 }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  {searchTerm ?
                    `没有找到匹配 "${searchTerm}" 的账户。请尝试其他搜索词。` :
                    '没有找到账户。点击"添加账户"来连接您的第一个Google Cloud账户。'
                  }
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
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
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                      <Switch
                        checked={account.needMonitor || false}
                        onChange={() => handleToggleMonitoring(account.id, account.needMonitor)}
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {account.needMonitor ? '开启' : '关闭'}
                      </Typography>
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
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(authUrl)
                  toast.success('链接已复制到剪贴板!')
                }}
              >
                复制链接
              </Button>
              <Button
                size="small"
                startIcon={<Cloud />}
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