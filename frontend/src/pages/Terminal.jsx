import React, { useState, useEffect, useRef } from 'react'
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Chip
} from '@mui/material'
import {
  Send as SendIcon,
  Clear as ClearIcon,
  Cancel as CancelIcon
} from '@mui/icons-material'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import axios from 'axios'
import { toast } from 'react-toastify'
import io from 'socket.io-client'
import { useAuth } from '../contexts/AuthContext'

function Terminal() {
  const { token } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [socket, setSocket] = useState(null)
  const [tabValue, setTabValue] = useState(0)
  const [cloudShellCommand, setCloudShellCommand] = useState('')
  const [asyncMode, setAsyncMode] = useState(false)
  const [executionId, setExecutionId] = useState(null)
  const [pollingInterval, setPollingInterval] = useState(null)
  const [lastExecutionOutput, setLastExecutionOutput] = useState(null)
  const [pollingCount, setPollingCount] = useState(0)
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)

  useEffect(() => {
    fetchAccounts()
    initializeTerminal()
    initializeSocket()

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose()
      }
      if (socket) {
        socket.disconnect()
      }
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/gcloud-accounts')
      const accounts = response.data.accounts || []
      const activeAccounts = accounts.filter(acc => acc.isActive)
      setAccounts(activeAccounts)
      if (activeAccounts.length > 0) {
        setSelectedAccount(activeAccounts[0].id)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('获取账户失败')
    }
  }

  const initializeTerminal = () => {
    if (!terminalRef.current) return

    const xterm = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff'
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 1000
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)
    xterm.open(terminalRef.current)

    fitAddon.fit()

    window.addEventListener('resize', () => {
      fitAddon.fit()
    })

    xterm.writeln('欢迎使用 GCloud 终端')
    xterm.writeln('选择一个账户并运行命令...')
    xterm.writeln('')

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon
  }

  const initializeSocket = () => {
    const newSocket = io({
      auth: { token }
    })

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
    })

    newSocket.on('command-started', ({ executionId }) => {
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[33mExecution started: ${executionId}\x1b[0m`)
      }
    })

    newSocket.on('command-output', ({ output }) => {
      if (xtermRef.current) {
        xtermRef.current.write(output)
      }
    })

    newSocket.on('command-error', ({ error }) => {
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[31mError: ${error}\x1b[0m`)
      }
      toast.error(`命令错误: ${error}`)
      setLoading(false)
    })

    newSocket.on('command-complete', () => {
      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[32m命令执行完成\x1b[0m')
        xtermRef.current.writeln('')
      }
      setLoading(false)
    })

    setSocket(newSocket)
  }

  const cleanupExistingExecution = async () => {
    // Cancel any existing polling
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }

    // Cancel existing execution if any
    if (executionId) {
      try {
        await axios.post(`/api/commands/executions/${executionId}/cancel`)
      } catch (error) {
        // Ignore cancel errors
      }
      setExecutionId(null)
    }

    // Reset polling state
    setPollingCount(0)
    setLastExecutionOutput(null)
  }

  const pollExecutionStatus = async (execId, intervalId) => {
    try {
      setPollingCount(prev => prev + 1)

      const response = await axios.get(`/api/commands/executions/${execId}`)
      const { execution } = response.data

      // Update status indicator
      if (xtermRef.current && execId === executionId) {
        // Clear previous output if it exists
        if (lastExecutionOutput) {
          const linesToClear = lastExecutionOutput.split('\n').length + 2
          for (let i = 0; i < linesToClear; i++) {
            xtermRef.current.write('\x1b[2K\x1b[1A')  // Clear line and move up
          }
        }

        // Show current status
        if (execution.status === 'running' || execution.status === 'pending') {
          const statusLine = `\x1b[33m⏳ 正在执行中... (检查 ${pollingCount})\x1b[0m`
          xtermRef.current.writeln(statusLine)
          setLastExecutionOutput(statusLine)
        }
      }

      if (execution.status === 'completed' || execution.status === 'failed') {
        // Stop polling immediately
        if (intervalId) {
          clearInterval(intervalId)
        }
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }

        // Display final results
        if (xtermRef.current && execId === executionId) {
          // Clear the status line
          if (lastExecutionOutput) {
            xtermRef.current.write('\x1b[2K\x1b[1A')
          }

          if (execution.output) {
            // Properly format output with preserved tabs and newlines
            const lines = execution.output.split('\n')
            lines.forEach(line => {
              if (line) {
                xtermRef.current.writeln(line)
              }
            })
          }
          if (execution.error) {
            xtermRef.current.writeln(`\x1b[31mError: ${execution.error}\x1b[0m`)
          }
          xtermRef.current.writeln(`\x1b[32m✓ 执行${execution.status === 'completed' ? '完成' : '失败'} (${execution.executionTime}ms)\x1b[0m`)
        }

        setLoading(false)
        setExecutionId(null)
        setLastExecutionOutput(null)
        setPollingCount(0)
        return true // Indicate completion
      }
      return false // Still running
    } catch (error) {
      console.error('Error polling execution:', error)

      // Check if it's a rate limit error
      if (error.response?.status === 429) {
        if (xtermRef.current) {
          xtermRef.current.writeln(`\x1b[31m⚠ 达到速率限制。等待更长时间后重试...\x1b[0m`)
        }
        // Don't stop polling on rate limit, just wait longer
        return false
      }

      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      setLoading(false)
      setExecutionId(null)
      setLastExecutionOutput(null)
      setPollingCount(0)
      return true // Stop on other errors
    }
  }

  const handleExecuteCommand = async () => {
    if (!selectedAccount) {
      toast.error('请选择一个账户')
      return
    }

    if (!command.trim()) {
      toast.error('请输入命令')
      return
    }

    // Clean up any existing execution before starting new one
    await cleanupExistingExecution()
    setLoading(true)

    if (xtermRef.current) {
      xtermRef.current.writeln(`\x1b[36m$ gcloud ${command}${asyncMode ? ' [ASYNC]' : ''}\x1b[0m`)
    }

    if (socket && socket.connected && !asyncMode) {
      socket.emit('execute-command', {
        accountId: selectedAccount,
        command: command
      })
    } else {
      try {
        const response = await axios.post('/api/commands/execute', {
          accountId: selectedAccount,
          command: command,
          async: asyncMode
        })

        if (asyncMode) {
          // Async execution
          const execId = response.data.executionId
          setExecutionId(execId)

          if (xtermRef.current) {
            xtermRef.current.writeln(`\x1b[33m🚀 执行已开始，ID: ${execId.substring(0, 8)}...\x1b[0m`)
            xtermRef.current.writeln(`\x1b[33m⏳ 每2.5秒检查一次状态...\x1b[0m`)
          }

          // Start polling with proper cleanup (every 2.5 seconds to avoid rate limiting)
          setPollingCount(0)
          setLastExecutionOutput(null)
          const interval = setInterval(async () => {
            const completed = await pollExecutionStatus(execId, interval)
            if (completed) {
              clearInterval(interval)
            }
          }, 2500)  // Poll every 2.5 seconds instead of 1 second
          setPollingInterval(interval)
        } else {
          // Sync execution
          if (xtermRef.current) {
            xtermRef.current.writeln(response.data.output)
            xtermRef.current.writeln('')
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Error executing command:', error)
        toast.error('执行命令失败')
        if (xtermRef.current) {
          xtermRef.current.writeln(`\x1b[31mError: ${error.response?.data?.error || error.message}\x1b[0m`)
        }
        setLoading(false)
      }
    }

    setCommand('')
  }

  const handleExecuteCloudShell = async () => {
    if (!selectedAccount) {
      toast.error('请选择一个账户')
      return
    }

    if (!cloudShellCommand.trim()) {
      toast.error('请输入命令')
      return
    }

    // Clean up any existing execution before starting new one
    await cleanupExistingExecution()
    setLoading(true)

    if (xtermRef.current) {
      xtermRef.current.writeln(`\x1b[36m$ [Cloud Shell] ${cloudShellCommand}${asyncMode ? ' [ASYNC]' : ''}\x1b[0m`)
    }

    if (socket && socket.connected && !asyncMode) {
      socket.emit('cloud-shell-command', {
        accountId: selectedAccount,
        command: cloudShellCommand
      })
    } else {
      try {
        const response = await axios.post('/api/commands/cloud-shell', {
          accountId: selectedAccount,
          command: cloudShellCommand,
          async: asyncMode
        })

        if (asyncMode) {
          // Async execution
          const execId = response.data.executionId
          setExecutionId(execId)

          if (xtermRef.current) {
            xtermRef.current.writeln(`\x1b[33m🚀 执行已开始，ID: ${execId.substring(0, 8)}...\x1b[0m`)
            xtermRef.current.writeln(`\x1b[33m⏳ 每2.5秒检查一次状态...\x1b[0m`)
          }

          // Start polling with proper cleanup (every 2.5 seconds to avoid rate limiting)
          setPollingCount(0)
          setLastExecutionOutput(null)
          const interval = setInterval(async () => {
            const completed = await pollExecutionStatus(execId, interval)
            if (completed) {
              clearInterval(interval)
            }
          }, 2500)  // Poll every 2.5 seconds instead of 1 second
          setPollingInterval(interval)
        } else {
          // Sync execution
          if (xtermRef.current) {
            xtermRef.current.writeln(response.data.output)
            xtermRef.current.writeln('')
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Error executing Cloud Shell command:', error)
        toast.error('执行Cloud Shell命令失败')
        if (xtermRef.current) {
          xtermRef.current.writeln(`\x1b[31mError: ${error.response?.data?.error || error.message}\x1b[0m`)
        }
        setLoading(false)
      }
    }

    setCloudShellCommand('')
  }

  const handleClearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear()
    }
  }

  const handleCancelExecution = async () => {
    if (!executionId) return

    try {
      await axios.post(`/api/commands/executions/${executionId}/cancel`)

      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }

      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[33m执行已取消\x1b[0m`)
      }

      toast.success('执行已取消')
      setExecutionId(null)
      setLoading(false)
    } catch (error) {
      console.error('Error cancelling execution:', error)
      toast.error('取消执行失败')
    }
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        终端
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>账户</InputLabel>
            <Select
              value={selectedAccount}
              label="账户"
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={handleClearTerminal}
          >
            清空
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
          <Tab label="GCloud 命令" />
          <Tab label="Cloud Shell" />
        </Tabs>

        {tabValue === 0 && (
          <Box>
            <Box display="flex" gap={2} alignItems="center" mb={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={asyncMode}
                    onChange={(e) => setAsyncMode(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="异步模式"
              />
              {executionId && (
                <Chip
                  label={`运行中: ${executionId.substring(0, 8)}...`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                label="GCloud 命令"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleExecuteCommand()
                  }
                }}
                placeholder="例如: compute instances list"
                disabled={loading}
              />
              {executionId ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={handleCancelExecution}
                  sx={{ minWidth: 120 }}
                >
                  取消
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  onClick={handleExecuteCommand}
                  disabled={loading || !command.trim()}
                  sx={{ minWidth: 120 }}
                >
                  执行
                </Button>
              )}
            </Box>
          </Box>
        )}

        {tabValue === 1 && (
          <Box>
            <Box display="flex" gap={2} alignItems="center" mb={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={asyncMode}
                    onChange={(e) => setAsyncMode(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="异步模式"
              />
              {executionId && (
                <Chip
                  label={`运行中: ${executionId.substring(0, 8)}...`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                label="Cloud Shell 命令"
                value={cloudShellCommand}
                onChange={(e) => setCloudShellCommand(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleExecuteCloudShell()
                  }
                }}
                placeholder="例如: ls -la"
                disabled={loading}
              />
              {executionId ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={handleCancelExecution}
                  sx={{ minWidth: 120 }}
                >
                  取消
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  onClick={handleExecuteCloudShell}
                  disabled={loading || !cloudShellCommand.trim()}
                  sx={{ minWidth: 120 }}
                >
                  执行
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2, backgroundColor: '#1e1e1e' }}>
        <div
          ref={terminalRef}
          style={{
            height: '400px',
            width: '100%'
          }}
        />
      </Paper>
    </Container>
  )
}

export default Terminal