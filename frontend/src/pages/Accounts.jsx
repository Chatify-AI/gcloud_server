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
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  AttachMoney as MoneyIcon,
  Visibility as ViewIcon
} from '@mui/icons-material'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useAuth } from '../contexts/AuthContext'

function Accounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [editAccount, setEditAccount] = useState(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

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

      const response = await axios.get('/api/accounts', { params })
      setAccounts(response.data.accounts)
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }))

      // 自动异步获取消费数据
      if (response.data.accounts.length > 0) {
        fetchConsumptionData(response.data.accounts)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Failed to fetch accounts')
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
      const response = await axios.post('/api/accounts/batch-consumption', {
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

  const handleAddAccount = async () => {
    try {
      const response = await axios.post('/api/accounts/add')
      setAuthUrl(response.data.authUrl)
      setDialogOpen(true)
      window.open(response.data.authUrl, '_blank', 'width=600,height=600')
      toast.info('Please authorize in the opened window')
    } catch (error) {
      console.error('Error generating auth URL:', error)
      toast.error('Failed to generate authorization URL')
    }
  }

  const handleSubmitCode = async () => {
    if (!authCode.trim()) {
      toast.error('Please enter the authorization code')
      return
    }

    try {
      const response = await axios.post('/api/auth/google/callback', {
        code: authCode,
        userId: user.id
      })

      if (response.data.success) {
        toast.success(response.data.message)
        setDialogOpen(false)
        setAuthCode('')
        setAuthUrl('')
        fetchAccounts()
      }
    } catch (error) {
      console.error('Error adding account:', error)
      toast.error('Failed to add account')
    }
  }

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to delete this account?')) {
      return
    }

    try {
      await axios.delete(`/api/accounts/${accountId}`)
      toast.success('Account deleted successfully')
      fetchAccounts()
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Failed to delete account')
    }
  }

  const handleRefreshToken = async (accountId) => {
    try {
      await axios.post(`/api/accounts/${accountId}/refresh`)
      toast.success('Token refreshed successfully')
      fetchAccounts()
    } catch (error) {
      console.error('Error refreshing token:', error)
      toast.error('Failed to refresh token')
    }
  }

  const handleEditAccount = (account) => {
    setEditAccount({
      ...account,
      projectId: account.projectId || '',
      projectName: account.projectName || ''
    })
    setEditDialogOpen(true)
  }

  const handleUpdateAccount = async () => {
    try {
      await axios.put(`/api/accounts/${editAccount.id}`, {
        projectId: editAccount.projectId,
        projectName: editAccount.projectName,
        isActive: editAccount.isActive
      })
      toast.success('Account updated successfully')
      setEditDialogOpen(false)
      fetchAccounts()
    } catch (error) {
      console.error('Error updating account:', error)
      toast.error('Failed to update account')
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(authUrl)
    toast.success('URL copied to clipboard!')
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
          Google Cloud Accounts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddAccount}
        >
          Add Account
        </Button>
      </Box>

      {/* 搜索和控制区域 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            placeholder="Search by email, project ID or name..."
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
            Search
          </Button>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Page Size</InputLabel>
            <Select
              value={pagination.showAll ? 'all' : pagination.pageSize}
              onChange={handlePageSizeChange}
              label="Page Size"
            >
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value="all">All</MenuItem>
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
              <TableCell>Email</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Consumption</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {searchTerm ?
                    `No accounts found matching "${searchTerm}". Try different search terms.` :
                    'No accounts found. Click "Add Account" to connect your first Google Cloud account.'
                  }
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {account.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {account.projectName || account.projectId || 'Not set'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={account.isActive ? 'Active' : 'Inactive'}
                      color={account.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {renderConsumptionCell(account)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {account.lastUsed
                        ? new Date(account.lastUsed).toLocaleString()
                        : 'Never'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
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
            Page {pagination.page} of {pagination.totalPages}
            ({pagination.total} total accounts)
          </Typography>
        </Box>
      )}

      {/* 添加账号对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Google Cloud Account</DialogTitle>
        <DialogContent>
          {authUrl && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Authorization URL:
              </Typography>
              <Paper sx={{ p: 1, backgroundColor: '#f5f5f5', mb: 1 }}>
                <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                  {authUrl}
                </Typography>
              </Paper>
              <Button
                size="small"
                startIcon={<CopyIcon />}
                onClick={handleCopyUrl}
              >
                Copy URL
              </Button>
            </Box>
          )}
          <TextField
            fullWidth
            label="Authorization Code"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="Paste the authorization code here"
            multiline
            rows={3}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitCode} variant="contained">
            Add Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑账号对话框 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Account</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email"
            value={editAccount?.email || ''}
            disabled
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Project ID"
            value={editAccount?.projectId || ''}
            onChange={(e) => setEditAccount({ ...editAccount, projectId: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Project Name"
            value={editAccount?.projectName || ''}
            onChange={(e) => setEditAccount({ ...editAccount, projectName: e.target.value })}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateAccount} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Accounts