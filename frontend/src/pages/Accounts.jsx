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
  CircularProgress
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon
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

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/accounts')
      setAccounts(response.data.accounts)
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Failed to fetch accounts')
    } finally {
      setLoading(false)
    }
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No accounts found. Click "Add Account" to connect your first Google Cloud account.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    {account.projectName || account.projectId || 'Not set'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={account.isActive ? 'Active' : 'Inactive'}
                      color={account.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {account.lastUsed
                      ? new Date(account.lastUsed).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="primary"
                      onClick={() => handleEditAccount(account)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="primary"
                      onClick={() => handleRefreshToken(account.id)}
                      title="Refresh Token"
                    >
                      <RefreshIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteAccount(account.id)}
                      title="Delete"
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