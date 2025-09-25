import React, { useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Pagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Cancel as CancelIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  PlayArrow as RunningIcon,
  ZoomIn as ZoomInIcon,
  ContentCopy as CopyIcon,
  Fullscreen as FullscreenIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import axios from 'axios'
import { toast } from 'react-toastify'

function History() {
  const [executions, setExecutions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedExecution, setSelectedExecution] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [fullscreenDialog, setFullscreenDialog] = useState(false)
  const [fullscreenContent, setFullscreenContent] = useState('')
  const [fullscreenTitle, setFullscreenTitle] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(null)

  // 分页和搜索相关状态
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    showAll: false
  })
  const [emailFilter, setEmailFilter] = useState('')
  const [emailFilterInput, setEmailFilterInput] = useState('')
  const [fullscreenAutoRefresh, setFullscreenAutoRefresh] = useState(false)
  const fullscreenTextFieldRef = React.useRef(null)

  useEffect(() => {
    fetchExecutions()
  }, [pagination.page, pagination.pageSize, pagination.showAll, emailFilter])

  useEffect(() => {
    // 自动刷新处理 - 包括普通对话框和全屏对话框
    if ((autoRefresh || fullscreenAutoRefresh) && selectedExecution && selectedExecution.status === 'running') {
      const interval = setInterval(() => {
        refreshExecutionDetails()
      }, 3000) // 每3秒刷新一次
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    }
  }, [autoRefresh, fullscreenAutoRefresh, selectedExecution])

  // 自动滚动到底部
  const scrollToBottom = () => {
    if (fullscreenTextFieldRef.current) {
      const textareaElement = fullscreenTextFieldRef.current.querySelector('textarea')
      if (textareaElement) {
        textareaElement.scrollTop = textareaElement.scrollHeight
      }
    }
  }

  // 当内容更新时自动滚动到底部
  useEffect(() => {
    if (fullscreenDialog && fullscreenContent) {
      setTimeout(scrollToBottom, 100) // 延迟一点确保内容已渲染
    }
  }, [fullscreenContent, fullscreenDialog])

  const fetchExecutions = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        showAll: pagination.showAll
      }

      if (emailFilter && emailFilter.trim()) {
        params.email = emailFilter.trim()
      }

      const response = await axios.get('/api/commands/executions', { params })
      setExecutions(response.data.executions)
      setTotal(response.data.total)
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }))
    } catch (error) {
      console.error('Error fetching executions:', error)
      toast.error('Failed to fetch execution history')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelExecution = async (executionId) => {
    try {
      await axios.post(`/api/commands/executions/${executionId}/cancel`)
      toast.success('Execution cancelled')
      fetchExecutions()
    } catch (error) {
      console.error('Error cancelling execution:', error)
      toast.error('Failed to cancel execution')
    }
  }

  const handleViewDetails = async (executionId) => {
    try {
      const response = await axios.get(`/api/commands/executions/${executionId}`)
      setSelectedExecution(response.data.execution)
      setDetailsOpen(true)
      // 如果是运行中的任务，默认开启自动刷新
      if (response.data.execution.status === 'running') {
        setAutoRefresh(true)
      }
    } catch (error) {
      console.error('Error fetching execution details:', error)
      toast.error('Failed to fetch execution details')
    }
  }

  const refreshExecutionDetails = async () => {
    if (!selectedExecution) return

    setRefreshing(true)
    try {
      const response = await axios.get(`/api/commands/executions/${selectedExecution.id}`)
      const updatedExecution = response.data.execution
      setSelectedExecution(updatedExecution)

      // 如果全屏对话框打开且显示的是输出内容，更新全屏内容
      if (fullscreenDialog && fullscreenTitle === '命令输出' && updatedExecution.output) {
        setFullscreenContent(updatedExecution.output)
      }
      // 如果显示的是错误内容，更新错误内容
      else if (fullscreenDialog && fullscreenTitle === '错误信息' && updatedExecution.error) {
        setFullscreenContent(updatedExecution.error)
      }

      // 如果任务完成了，停止自动刷新
      if (updatedExecution.status !== 'running' && (autoRefresh || fullscreenAutoRefresh)) {
        setAutoRefresh(false)
        setFullscreenAutoRefresh(false)
        toast.info('任务已完成，停止自动刷新')
      }
    } catch (error) {
      console.error('Error refreshing execution details:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleEmailFilter = () => {
    setEmailFilter(emailFilterInput)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleEmailFilter()
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
      pageSize: showAll ? 20 : newPageSize,
      showAll,
      page: 1
    }))
  }

  const handleChangePage = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage + 1 }))
  }

  const handleChangeRowsPerPage = (event) => {
    const newPageSize = parseInt(event.target.value, 10)
    setPagination(prev => ({
      ...prev,
      pageSize: newPageSize,
      page: 1,
      showAll: false
    }))
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon fontSize="small" color="success" />
      case 'failed':
        return <ErrorIcon fontSize="small" color="error" />
      case 'running':
        return <RunningIcon fontSize="small" color="primary" />
      case 'pending':
        return <PendingIcon fontSize="small" color="warning" />
      case 'cancelled':
        return <CancelIcon fontSize="small" color="disabled" />
      default:
        return null
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'failed':
        return 'error'
      case 'running':
        return 'primary'
      case 'pending':
        return 'warning'
      case 'cancelled':
        return 'default'
      default:
        return 'default'
    }
  }

  const formatDuration = (milliseconds) => {
    if (!milliseconds) return 'N/A'
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }

  const handleOpenFullscreen = (content, title) => {
    setFullscreenContent(content)
    setFullscreenTitle(title)
    setFullscreenDialog(true)
    // 如果是运行中的任务，默认开启全屏自动刷新
    if (selectedExecution && selectedExecution.status === 'running') {
      setFullscreenAutoRefresh(true)
    }
  }

  const handleCopyToClipboard = async (text, label = '内容') => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}已复制到剪贴板`)
    } catch (error) {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        toast.success(`${label}已复制到剪贴板`)
      } catch (err) {
        toast.error('复制失败')
      }
      document.body.removeChild(textarea)
    }
  }

  if (loading && executions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        执行历史记录
      </Typography>

      {/* 搜索和控制区域 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            placeholder="按邮箱筛选..."
            value={emailFilterInput}
            onChange={(e) => setEmailFilterInput(e.target.value)}
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
            onClick={handleEmailFilter}
            startIcon={<SearchIcon />}
          >
            筛选
          </Button>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>每页显示</InputLabel>
            <Select
              value={pagination.showAll ? 'all' : pagination.pageSize}
              onChange={handlePageSizeChange}
              label="每页显示"
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value="all">全部</MenuItem>
            </Select>
          </FormControl>
          {loading && (
            <CircularProgress size={20} />
          )}
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>状态</TableCell>
              <TableCell>命令</TableCell>
              <TableCell>账户</TableCell>
              <TableCell>执行者</TableCell>
              <TableCell>开始时间</TableCell>
              <TableCell>耗时</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {emailFilter ?
                    `未找到包含 "${emailFilter}" 的执行记录` :
                    '暂无执行记录'
                  }
                </TableCell>
              </TableRow>
            ) : (
              executions.map((execution) => (
                <TableRow key={execution.id}>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(execution.status)}
                      label={execution.status}
                      color={getStatusColor(execution.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={execution.command}
                    >
                      {execution.command}
                    </Typography>
                  </TableCell>
                  <TableCell>{execution.account?.email || 'N/A'}</TableCell>
                  <TableCell>{execution.executedBy || 'N/A'}</TableCell>
                  <TableCell>
                    {execution.startedAt
                      ? new Date(execution.startedAt).toLocaleString()
                      : 'Not started'}
                  </TableCell>
                  <TableCell>{formatDuration(execution.executionTime)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="primary"
                      onClick={() => handleViewDetails(execution.id)}
                      title="View Details"
                    >
                      <ViewIcon />
                    </IconButton>
                    {execution.status === 'running' && (
                      <IconButton
                        color="error"
                        onClick={() => handleCancelExecution(execution.id)}
                        title="Cancel"
                      >
                        <CancelIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 旧版TablePagination保持兼容性 */}
        {!pagination.showAll && (
          <TablePagination
            rowsPerPageOptions={[10, 20, 50, 100]}
            component="div"
            count={total}
            rowsPerPage={pagination.pageSize}
            page={pagination.page - 1}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelDisplayedRows={({ from, to, count }) => `第 ${from}-${to} 条，共 ${count} 条`}
            labelRowsPerPage="每页显示："
          />
        )}
      </TableContainer>

      {/* 新版分页控件 */}
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
            ({total} 条记录)
          </Typography>
        </Box>
      )}

      <Dialog
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false)
          setAutoRefresh(false)
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              执行详情
              {selectedExecution && (
                <Chip
                  icon={getStatusIcon(selectedExecution.status)}
                  label={selectedExecution.status}
                  color={getStatusColor(selectedExecution.status)}
                  size="small"
                  sx={{ ml: 2 }}
                />
              )}
            </Typography>

            {selectedExecution && selectedExecution.status === 'running' && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      size="small"
                    />
                  }
                  label="自动刷新"
                  sx={{ mr: 2 }}
                />
                <IconButton
                  onClick={refreshExecutionDetails}
                  disabled={refreshing}
                  title="手动刷新"
                  size="small"
                >
                  {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedExecution && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Command:
              </Typography>
              <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {selectedExecution.command}
                </Typography>
              </Paper>

              <Typography variant="subtitle2" gutterBottom>
                Account:
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedExecution.account?.email} ({selectedExecution.account?.projectId || 'No project'})
              </Typography>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Timing:
              </Typography>
              <Typography variant="body2" gutterBottom>
                Started: {selectedExecution.startedAt
                  ? new Date(selectedExecution.startedAt).toLocaleString()
                  : 'Not started'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Completed: {selectedExecution.completedAt
                  ? new Date(selectedExecution.completedAt).toLocaleString()
                  : 'Not completed'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Duration: {formatDuration(selectedExecution.executionTime)}
              </Typography>

              {selectedExecution.output && (
                <>
                  <Box display="flex" alignItems="center" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ flexGrow: 1 }}>
                      输出: {selectedExecution.output && `(${selectedExecution.output.length} 字符)`}
                    </Typography>
                    {selectedExecution.status === 'running' && (
                      <IconButton
                        size="small"
                        onClick={refreshExecutionDetails}
                        disabled={refreshing}
                        title="刷新输出"
                      >
                        {refreshing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleCopyToClipboard(selectedExecution.output, '输出')}
                      title="复制输出"
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenFullscreen(selectedExecution.output, '命令输出')}
                      title="全屏查看"
                    >
                      <FullscreenIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={10}
                    value={selectedExecution.output}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: 12 }
                    }}
                    variant="outlined"
                  />
                </>
              )}

              {selectedExecution.error && (
                <>
                  <Box display="flex" alignItems="center" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ flexGrow: 1 }} color="error">
                      错误:
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleCopyToClipboard(selectedExecution.error, '错误信息')}
                      title="复制错误"
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenFullscreen(selectedExecution.error, '错误信息')}
                      title="全屏查看"
                    >
                      <FullscreenIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={5}
                    value={selectedExecution.error}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: 12 }
                    }}
                    variant="outlined"
                    error
                  />
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailsOpen(false)
            setAutoRefresh(false)
          }}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 全屏查看对话框 */}
      <Dialog
        fullScreen
        open={fullscreenDialog}
        onClose={() => setFullscreenDialog(false)}
      >
        <DialogTitle sx={{ backgroundColor: '#1976d2', color: 'white' }}>
          <Box display="flex" alignItems="center">
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {fullscreenTitle}
              {selectedExecution && (
                <Chip
                  icon={getStatusIcon(selectedExecution.status)}
                  label={selectedExecution.status}
                  color={getStatusColor(selectedExecution.status)}
                  size="small"
                  sx={{ ml: 2 }}
                />
              )}
            </Typography>

            {/* 自动刷新控制 - 仅在任务运行中显示 */}
            {selectedExecution && selectedExecution.status === 'running' && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={fullscreenAutoRefresh}
                      onChange={(e) => setFullscreenAutoRefresh(e.target.checked)}
                      size="small"
                    />
                  }
                  label="自动刷新"
                  sx={{ mr: 2, color: 'white' }}
                />
                <IconButton
                  color="inherit"
                  onClick={refreshExecutionDetails}
                  disabled={refreshing}
                  title="手动刷新"
                  size="small"
                >
                  {refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                </IconButton>
              </>
            )}

            <IconButton
              color="inherit"
              onClick={() => handleCopyToClipboard(fullscreenContent, fullscreenTitle)}
              title="复制内容"
            >
              <CopyIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => {
                setFullscreenDialog(false)
                setFullscreenAutoRefresh(false)
              }}
              title="关闭"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1e1e1e', p: 0 }}>
          <TextField
            ref={fullscreenTextFieldRef}
            fullWidth
            multiline
            value={fullscreenContent}
            InputProps={{
              readOnly: true,
              sx: {
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: 14,
                color: '#ffffff',
                backgroundColor: '#1e1e1e',
                border: 'none',
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none'
                }
              }
            }}
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '100vh',
                alignItems: 'flex-start'
              }
            }}
            variant="outlined"
          />
        </DialogContent>
      </Dialog>
    </Container>
  )
}

export default History