import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material'
import {
  Lock as LockIcon,
  Person as PersonIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

function AdminLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    checkSetup()
  }, [])

  const checkSetup = async () => {
    try {
      const response = await axios.get('/api/admin/check-setup')
      setNeedsSetup(response.data.needsSetup)
    } catch (error) {
      console.error('Error checking setup:', error)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)

    try {
      const response = await axios.post('/api/admin/login', {
        username,
        password
      })

      if (response.data.success) {
        login(response.data.token, response.data.admin)
        toast.success('登录成功！')
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error || '登录失败')
      toast.error('登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少6位')
      return
    }

    setLoading(true)

    try {
      const response = await axios.post('/api/admin/setup', {
        username,
        password
      })

      if (response.data.success) {
        toast.success('管理员账户创建成功！请登录。')
        setNeedsSetup(false)
        setPassword('')
      }
    } catch (err) {
      setError(err.response?.data?.error || '设置失败')
      toast.error('设置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <LockIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          </Box>

          <Typography component="h1" variant="h5" align="center" gutterBottom>
            GCloud 管理器
          </Typography>

          <Typography variant="body2" align="center" color="textSecondary" sx={{ mb: 3 }}>
            {needsSetup ? '设置管理员账户' : '管理员登录'}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={needsSetup ? handleSetup : handleLogin}>
            <TextField
              fullWidth
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="密码"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText={needsSetup ? "最少6个字符" : ""}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : needsSetup ? (
                '创建管理员账户'
              ) : (
                '登录'
              )}
            </Button>
          </Box>

          {needsSetup && (
            <Alert severity="info" sx={{ mt: 2 }}>
              这是首次设置。请创建一个管理员账户以开始使用。
            </Alert>
          )}
        </Paper>

        <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 2 }}>
          从单一控制台管理多个 Google Cloud 账户
        </Typography>
      </Box>
    </Container>
  )
}

export default AdminLogin