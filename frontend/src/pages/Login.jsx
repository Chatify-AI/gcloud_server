import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material'
import { Google as GoogleIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authUrl, setAuthUrl] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [showCodeInput, setShowCodeInput] = useState(false)

  const handleGetAuthUrl = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/auth/google/url')
      setAuthUrl(response.data.authUrl)
      setShowCodeInput(true)

      window.open(response.data.authUrl, '_blank', 'width=600,height=600')

      toast.info('Please authorize in the opened window and paste the code below')
    } catch (err) {
      setError('Failed to generate authorization URL')
      toast.error('Failed to generate authorization URL')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(authUrl)
    toast.success('Authorization URL copied to clipboard!')
  }

  const handleSubmitCode = async () => {
    if (!authCode.trim()) {
      setError('Please enter the authorization code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await axios.post('/api/auth/google/callback', {
        code: authCode
      })

      if (response.data.success) {
        login(response.data.token, response.data.user)
        toast.success('Login successful!')
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed')
      toast.error('Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async () => {
    if (!email.trim()) {
      setError('Please enter your email')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await axios.post('/api/auth/login', { email })
      login(response.data.token, response.data.user)
      toast.success('Login successful!')
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
      toast.error('Login failed')
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
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            GCloud Manager
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {!showCodeInput ? (
            <>
              <Button
                fullWidth
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={handleGetAuthUrl}
                disabled={loading}
                sx={{ mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign in with Google'}
              </Button>

              <Typography variant="body2" align="center" sx={{ my: 2 }}>
                OR
              </Typography>

              <TextField
                fullWidth
                label="Email (for existing users)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Button
                fullWidth
                variant="outlined"
                onClick={handleQuickLogin}
                disabled={loading}
              >
                Quick Login
              </Button>
            </>
          ) : (
            <>
              {authUrl && (
                <Box sx={{ mb: 3 }}>
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
                    onClick={handleCopyUrl}
                    sx={{ mb: 2 }}
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
                sx={{ mb: 2 }}
                multiline
                rows={2}
              />

              <Button
                fullWidth
                variant="contained"
                onClick={handleSubmitCode}
                disabled={loading}
                sx={{ mb: 1 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Submit Code'}
              </Button>

              <Button
                fullWidth
                variant="text"
                onClick={() => {
                  setShowCodeInput(false)
                  setAuthCode('')
                  setAuthUrl('')
                }}
              >
                Back
              </Button>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  )
}

export default Login