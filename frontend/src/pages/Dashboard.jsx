import React, { useState, useEffect } from 'react'
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Chip
} from '@mui/material'
import {
  Cloud as CloudIcon,
  Terminal as TerminalIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material'
import axios from 'axios'
import { toast } from 'react-toastify'

function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [recentExecutions, setRecentExecutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalAccounts: 0,
    activeAccounts: 0,
    totalExecutions: 0,
    successfulExecutions: 0
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [accountsRes, executionsRes] = await Promise.all([
        axios.get('/api/gcloud-accounts'),
        axios.get('/api/commands/executions?limit=5')
      ])

      const accounts = accountsRes.data.accounts || []
      const executions = executionsRes.data.executions || []

      setAccounts(accounts)
      setRecentExecutions(executions)

      const activeAccounts = accounts.filter(a => a.isActive).length
      const successfulExecutions = executions.filter(
        e => e.status === 'completed'
      ).length

      setStats({
        totalAccounts: accounts.length,
        activeAccounts,
        totalExecutions: executionsRes.data.total || 0,
        successfulExecutions
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('加载控制台数据失败')
    } finally {
      setLoading(false)
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
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" />
      case 'failed':
        return <ErrorIcon fontSize="small" />
      default:
        return null
    }
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
      <Typography variant="h4" gutterBottom>
        控制台
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CloudIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    总账户数
                  </Typography>
                  <Typography variant="h5">
                    {stats.totalAccounts}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircleIcon color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    活跃账户
                  </Typography>
                  <Typography variant="h5">
                    {stats.activeAccounts}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TerminalIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    总执行次数
                  </Typography>
                  <Typography variant="h5">
                    {stats.totalExecutions}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <HistoryIcon color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    成功率
                  </Typography>
                  <Typography variant="h5">
                    {stats.totalExecutions > 0
                      ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
                      : 0}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Google Cloud 账户
            </Typography>
            {accounts.length === 0 ? (
              <Typography color="textSecondary">
                尚未连接任何账户
              </Typography>
            ) : (
              <Box sx={{ mt: 2 }}>
                {accounts.map((account) => (
                  <Box
                    key={account.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: '#f5f5f5'
                    }}
                  >
                    <Box>
                      <Typography variant="body1">{account.email}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        项目: {account.projectName || account.projectId || '未设置'}
                      </Typography>
                    </Box>
                    <Chip
                      label={account.isActive ? '活跃' : '未激活'}
                      color={account.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              最近命令执行
            </Typography>
            {recentExecutions.length === 0 ? (
              <Typography color="textSecondary">
                尚未执行任何命令
              </Typography>
            ) : (
              <Box sx={{ mt: 2 }}>
                {recentExecutions.map((execution) => (
                  <Box
                    key={execution.id}
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: '#f5f5f5'
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {execution.command.substring(0, 50)}
                        {execution.command.length > 50 && '...'}
                      </Typography>
                      <Chip
                        label={execution.status}
                        color={getStatusColor(execution.status)}
                        size="small"
                        icon={getStatusIcon(execution.status)}
                      />
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {execution.account?.email} • {new Date(execution.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

export default Dashboard