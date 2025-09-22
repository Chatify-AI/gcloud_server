import React, { useState, useEffect } from 'react'
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
  Tooltip
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
  BugReport as BugReportIcon
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
  const [generatingUrl, setGeneratingUrl] = useState(false) // Add generating URL state
  const [monitorLogsDialogOpen, setMonitorLogsDialogOpen] = useState(false)
  const [selectedAccountLogs, setSelectedAccountLogs] = useState(null)
  const [monitorLogs, setMonitorLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [editingExecutionCount, setEditingExecutionCount] = useState({})
  const [tempExecutionCount, setTempExecutionCount] = useState({})
  const [testDetailsDialog, setTestDetailsDialog] = useState(false)
  const [selectedTestDetails, setSelectedTestDetails] = useState(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/gcloud-accounts')
      setAccounts(response.data.accounts)
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('获取Google Cloud账户失败')
    } finally {
      setLoading(false)
    }
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
        code: authCode,
        authId: authId // Include authId in the request
      })

      if (response.data.success) {
        toast.success(response.data.message)
        setDialogOpen(false)
        setAuthCode('')
        setAuthUrl('')
        setAuthId('') // Clear authId
        fetchAccounts()
      }
    } catch (error) {
      console.error('Error adding account:', error)
      toast.error(error.response?.data?.error || '添加账户失败')
    } finally {
      setAddingAccount(false)
    }
  }

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('确定要删除这个Google Cloud账户吗？')) {
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

  const handleRefreshToken = async (accountId) => {
    try {
      await axios.post(`/api/gcloud-accounts/${accountId}/refresh`)
      toast.success('令牌刷新成功')
      fetchAccounts()
    } catch (error) {
      console.error('Error refreshing token:', error)
      toast.error('刷新令牌失败')
    }
  }

  const handleMonitorToggle = async (accountId, currentStatus) => {
    try {
      const response = await axios.patch(
        `/api/gcloud-accounts/${accountId}/monitor`,
        { needMonitor: !currentStatus }
      )

      if (response.data.success) {
        toast.success(response.data.message)
        fetchAccounts()
      }
    } catch (error) {
      console.error('Error toggling monitor status:', error)
      toast.error('更新监听状态失败: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleExecutionCountEdit = (accountId, currentCount) => {
    setEditingExecutionCount({ ...editingExecutionCount, [accountId]: true })
    setTempExecutionCount({ ...tempExecutionCount, [accountId]: currentCount })
  }

  const handleExecutionCountSave = async (accountId) => {
    try {
      const newCount = parseInt(tempExecutionCount[accountId]) || 0
      const response = await axios.patch(
        `/api/gcloud-accounts/${accountId}/execution-count`,
        { scriptExecutionCount: newCount }
      )

      if (response.data.success) {
        toast.success('执行次数已更新')
        setEditingExecutionCount({ ...editingExecutionCount, [accountId]: false })
        fetchAccounts()
      }
    } catch (error) {
      console.error('Error updating execution count:', error)
      toast.error('更新执行次数失败: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleExecutionCountCancel = (accountId) => {
    setEditingExecutionCount({ ...editingExecutionCount, [accountId]: false })
    setTempExecutionCount({ ...tempExecutionCount, [accountId]: undefined })
  }

  const handleEditAccount = (account) => {
    setEditAccount({
      ...account,
      projectId: account.projectId || '',
      projectName: account.projectName || ''
    })
    setEditDialogOpen(true)
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
      toast.error('获取监听历史失败')
    } finally {
      setLogsLoading(false)
    }
  }

  const handleUpdateAccount = async () => {
    try {
      await axios.put(`/api/gcloud-accounts/${editAccount.id}`, {
        projectId: editAccount.projectId,
        projectName: editAccount.projectName,
        isActive: editAccount.isActive
      })
      toast.success('账户更新成功')
      setEditDialogOpen(false)
      fetchAccounts()
    } catch (error) {
      console.error('Error updating account:', error)
      toast.error('更新账户失败')
    }
  }

  const handleCopyUrl = async () => {
    try {
      // 方案1: 尝试现代 clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(authUrl)
          toast.success('授权链接已复制到剪贴板!')
          return
        } catch (err) {
          console.log('Clipboard API failed, trying fallback:', err)
        }
      }

      // 方案2: 降级方案 - 使用 textarea + execCommand
      const textArea = document.createElement('textarea')
      textArea.value = authUrl
      textArea.style.position = 'fixed'
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'
      textArea.setAttribute('readonly', '')

      document.body.appendChild(textArea)

      // 选择文本
      textArea.select()
      textArea.setSelectionRange(0, 99999) // 对移动设备

      try {
        const successful = document.execCommand('copy')
        if (successful) {
          toast.success('授权链接已复制到剪贴板!')
        } else {
          throw new Error('execCommand returned false')
        }
      } catch (err) {
        console.error('execCommand copy failed:', err)
        // 方案3: 手动选择文本，让用户自己复制
        showManualCopyDialog()
      } finally {
        document.body.removeChild(textArea)
      }

    } catch (error) {
      console.error('Error copying to clipboard:', error)
      showManualCopyDialog()
    }
  }

  const showManualCopyDialog = () => {
    // 显示一个对话框让用户手动复制
    const copyDialog = document.createElement('div')
    copyDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 80%;
      word-break: break-all;
    `

    copyDialog.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold;">请手动复制授权链接:</div>
      <textarea readonly style="width: 100%; height: 100px; margin-bottom: 10px; font-size: 12px;">${authUrl}</textarea>
      <div style="text-align: right;">
        <button onclick="this.parentElement.parentElement.remove()" style="padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
      </div>
    `

    document.body.appendChild(copyDialog)

    // 自动选择文本
    const textarea = copyDialog.querySelector('textarea')
    textarea.focus()
    textarea.select()

    // 5秒后自动关闭
    setTimeout(() => {
      if (copyDialog.parentNode) {
        copyDialog.remove()
      }
    }, 10000)

    toast.info('自动复制失败，请手动复制链接')
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="lg">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <CloudIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4">
            Google Cloud 账户
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={generatingUrl ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
          onClick={handleGenerateAuthUrl}
          disabled={generatingUrl}
        >
          {generatingUrl ? '生成中...' : '添加账户'}
        </Button>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Typography variant="body2" color="textSecondary">
          总账户数: {accounts.length} |
          活跃: {accounts.filter(a => a.isActive).length} |
          未激活: {accounts.filter(a => !a.isActive).length}
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>账户</TableCell>
              <TableCell>项目</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>监听</TableCell>
              <TableCell>执行次数</TableCell>
              <TableCell>最后使用</TableCell>
              <TableCell>添加时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CloudIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="textSecondary">
                    尚未添加Google Cloud账户
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    点击"添加账户"连接您的第一个Google Cloud账户
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                        {account.email.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {account.displayName || account.email.split('@')[0]}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {account.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {account.projectName || account.projectId || '未配置'}
                    </Typography>
                    {account.projectId && (
                      <Typography variant="caption" color="textSecondary">
                        {account.projectId}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={account.isActive ? '活跃' : '未激活'}
                      color={account.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={account.needMonitor ? '监听已开启' : '监听已关闭'}>
                      <Switch
                        checked={account.needMonitor || false}
                        onChange={() => handleMonitorToggle(account.id, account.needMonitor)}
                        color="primary"
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {editingExecutionCount[account.id] ? (
                        <>
                          <TextField
                            size="small"
                            type="number"
                            value={tempExecutionCount[account.id] ?? account.scriptExecutionCount ?? 0}
                            onChange={(e) => setTempExecutionCount({ ...tempExecutionCount, [account.id]: e.target.value })}
                            sx={{ width: 60 }}
                            inputProps={{ min: 0 }}
                          />
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleExecutionCountSave(account.id)}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleExecutionCountCancel(account.id)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <Typography
                            variant="body2"
                            sx={{
                              color: account.scriptExecutionCount === 0 ? 'warning.main' : 'text.primary',
                              fontWeight: account.scriptExecutionCount === 0 ? 'bold' : 'normal'
                            }}
                          >
                            {account.scriptExecutionCount ?? 0}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleExecutionCountEdit(account.id, account.scriptExecutionCount ?? 0)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {account.lastUsed
                      ? new Date(account.lastUsed).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    {new Date(account.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="查看监听历史">
                      <IconButton
                        color="primary"
                        onClick={() => handleViewMonitorLogs(account)}
                        size="small"
                      >
                        <HistoryIcon />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      color="primary"
                      onClick={() => handleEditAccount(account)}
                      title="Edit"
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="primary"
                      onClick={() => handleRefreshToken(account.id)}
                      title="Refresh Token"
                      size="small"
                    >
                      <RefreshIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteAccount(account.id)}
                      title="Delete"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Account Dialog */}
      <Dialog open={dialogOpen} onClose={() => !addingAccount && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加 Google Cloud 账户</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            请按照以下步骤添加新的 Google Cloud 账户：
          </Typography>
          <Box sx={{ pl: 2, mb: 2 }}>
            <Typography variant="body2">
              1. 复制下方的授权链接
            </Typography>
            <Typography variant="body2">
              2. 在新标签页中打开链接
            </Typography>
            <Typography variant="body2">
              3. 使用您的 Google 账户登录
            </Typography>
            <Typography variant="body2">
              4. 授权所需的权限
            </Typography>
            <Typography variant="body2">
              5. 复制授权码
            </Typography>
            <Typography variant="body2">
              6. 将授权码粘贴到下方并点击"添加账户"
            </Typography>
          </Box>

          {authUrl && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                授权链接：
              </Typography>
              <TextField
                fullWidth
                value={authUrl}
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: 12 }
                }}
                sx={{ mb: 1 }}
                onClick={(e) => e.target.select()}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CopyIcon />}
                  onClick={handleCopyUrl}
                >
                  复制链接
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  在新标签页打开
                </Button>
              </Box>
            </Box>
          )}

          <TextField
            fullWidth
            label="授权码"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="请将授权码粘贴到这里"
            multiline
            rows={3}
            sx={{ mt: 2 }}
            disabled={addingAccount}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={addingAccount}>
            取消
          </Button>
          <Button
            onClick={handleAddAccount}
            variant="contained"
            disabled={addingAccount || !authCode.trim()}
          >
            {addingAccount ? <CircularProgress size={24} /> : '添加账户'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑账户</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="邮箱"
            value={editAccount?.email || ''}
            disabled
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="项目 ID"
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
            更新
          </Button>
        </DialogActions>
      </Dialog>

      {/* Monitor Logs Dialog */}
      <Dialog open={monitorLogsDialogOpen} onClose={() => setMonitorLogsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          监听历史 - {selectedAccountLogs?.email}
        </DialogTitle>
        <DialogContent>
          {logsLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : monitorLogs.length === 0 ? (
            <Typography color="textSecondary" align="center" py={3}>
              暂无监听记录
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>时间</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>测试渠道</TableCell>
                    <TableCell>成功渠道</TableCell>
                    <TableCell>脚本执行</TableCell>
                    <TableCell>消息</TableCell>
                    <TableCell>测试详情</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monitorLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.startTime).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.monitorStatus}
                          size="small"
                          color={
                            log.monitorStatus === 'success' ? 'success' :
                            log.monitorStatus === 'failed' ? 'error' :
                            log.monitorStatus === 'script_executed' ? 'warning' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell>{log.testedChannels || 0}</TableCell>
                      <TableCell>{log.successfulChannels || 0}</TableCell>
                      <TableCell>
                        {log.scriptExecuted ? (
                          <Chip label={log.scriptType || 'gemini'} size="small" color="primary" />
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" style={{ wordBreak: 'break-word' }}>
                          {log.message || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {log.testDetails ? (
                          <Tooltip title="查看测试详情">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setSelectedTestDetails(log.testDetails)
                                setTestDetailsDialog(true)
                              }}
                            >
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          '-'
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
          <Button onClick={() => setMonitorLogsDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* Test Details Dialog */}
      <Dialog open={testDetailsDialog} onClose={() => setTestDetailsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <BugReportIcon sx={{ mr: 1 }} />
              测试详细信息
            </Box>
            <IconButton onClick={() => setTestDetailsDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTestDetails ? (
            <Box>
              {/* 概要信息 */}
              <Typography variant="subtitle2" gutterBottom color="primary">
                测试概要
              </Typography>
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2">
                  总测试渠道数: {Array.isArray(selectedTestDetails) ? selectedTestDetails.length : 0}
                </Typography>
                <Typography variant="body2" color="success.main">
                  成功: {Array.isArray(selectedTestDetails) ? selectedTestDetails.filter(d => d.success).length : 0}
                </Typography>
                <Typography variant="body2" color="error.main">
                  失败: {Array.isArray(selectedTestDetails) ? selectedTestDetails.filter(d => !d.success).length : 0}
                </Typography>
              </Paper>

              {/* 详细测试结果 */}
              <Typography variant="subtitle2" gutterBottom color="primary">
                详细测试结果
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>渠道ID</TableCell>
                      <TableCell>渠道名称</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>耗时(ms)</TableCell>
                      <TableCell>消息/错误</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(selectedTestDetails) && selectedTestDetails.map((detail, index) => (
                      <TableRow key={index}>
                        <TableCell>{detail.channelId}</TableCell>
                        <TableCell>{detail.channelName}</TableCell>
                        <TableCell>
                          <Chip
                            label={detail.success ? '成功' : '失败'}
                            size="small"
                            color={detail.success ? 'success' : 'error'}
                            icon={detail.success ? <CheckIcon /> : <CloseIcon />}
                          />
                        </TableCell>
                        <TableCell>{detail.duration || detail.testDuration || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{
                            maxWidth: 300,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {detail.message || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title="查看完整响应">
                            <IconButton
                              size="small"
                              onClick={() => {
                                const apiResponse = detail.apiResponse || detail;
                                const formatted = JSON.stringify(apiResponse, null, 2)
                                navigator.clipboard.writeText(formatted)
                                toast.success('已复制完整响应到剪贴板')
                              }}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* 原始JSON数据 */}
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  原始数据 (JSON)
                </Typography>
                <Paper sx={{ p: 1, bgcolor: 'grey.900', maxHeight: 300, overflow: 'auto' }}>
                  <pre style={{
                    color: '#00ff00',
                    margin: 0,
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}>
                    {JSON.stringify(selectedTestDetails, null, 2)}
                  </pre>
                </Paper>
              </Box>
            </Box>
          ) : (
            <Typography align="center" color="textSecondary">
              无测试详情数据
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (selectedTestDetails) {
                const formatted = JSON.stringify(selectedTestDetails, null, 2)
                navigator.clipboard.writeText(formatted)
                toast.success('已复制全部数据到剪贴板')
              }
            }}
            startIcon={<CopyIcon />}
          >
            复制全部
          </Button>
          <Button onClick={() => setTestDetailsDialog(false)} variant="contained">
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default GCloudAccounts