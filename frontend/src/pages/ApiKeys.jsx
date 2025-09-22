import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
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
  Alert,
  Snackbar,
  Chip,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Key as KeyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ApiKeys() {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newKeyDialog, setNewKeyDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: ['execute:commands'],
    rateLimit: 100,
    expiresIn: 'never'
  });

  const availablePermissions = [
    { value: 'execute:commands', label: '执行命令' },
    { value: 'read:data', label: '读取数据' },
    { value: 'manage:accounts', label: '管理账号' },
    { value: 'manage:apikeys', label: '管理API Keys' }
  ];

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/apikeys`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setApiKeys(response.data.apiKeys || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      setSnackbar({
        open: true,
        message: '获取API Keys失败',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      let expiresAt = null;
      if (formData.expiresIn !== 'never') {
        const now = new Date();
        switch (formData.expiresIn) {
          case '7days':
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            break;
          case '1year':
            expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      const response = await axios.post(`${API_BASE_URL}/api/apikeys/generate`, {
        ...formData,
        expiresAt
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setNewKey(response.data.apiKey.plainKey);
      setNewKeyDialog(true);
      setOpenDialog(false);
      setFormData({
        name: '',
        description: '',
        permissions: ['execute:commands'],
        rateLimit: 100,
        expiresIn: 'never'
      });
      fetchApiKeys();
    } catch (error) {
      console.error('Failed to generate API key:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || '生成API Key失败',
        severity: 'error'
      });
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/apikeys/${id}`, {
        isActive: !isActive
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchApiKeys();
      setSnackbar({
        open: true,
        message: `API Key已${!isActive ? '启用' : '禁用'}`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to toggle API key:', error);
      setSnackbar({
        open: true,
        message: '操作失败',
        severity: 'error'
      });
    }
  };

  const handleDeleteKey = async (id) => {
    if (!window.confirm('确定要删除这个API Key吗？此操作无法撤销。')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/api/apikeys/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchApiKeys();
      setSnackbar({
        open: true,
        message: 'API Key已删除',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to delete API key:', error);
      setSnackbar({
        open: true,
        message: '删除失败',
        severity: 'error'
      });
    }
  };

  const handleCopyKey = () => {
    // 方案1: 尝试现代 clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(newKey)
        .then(() => {
          setSnackbar({
            open: true,
            message: 'API Key已复制到剪贴板',
            severity: 'success'
          });
        })
        .catch(() => {
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    try {
      // 方案2: 使用 textarea + execCommand
      const textarea = document.createElement('textarea');
      textarea.value = newKey;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      textarea.setAttribute('readonly', '');

      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999); // 移动设备兼容

      const successful = document.execCommand('copy');

      if (successful) {
        setSnackbar({
          open: true,
          message: 'API Key已复制到剪贴板',
          severity: 'success'
        });
      } else {
        throw new Error('execCommand failed');
      }

      document.body.removeChild(textarea);
    } catch (err) {
      // 方案3: 手动复制对话框
      showManualCopyDialog();
    }
  };

  const showManualCopyDialog = () => {
    const copyDialog = document.createElement('div');
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
    `;

    copyDialog.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold;">请手动复制 API Key:</div>
      <textarea readonly style="width: 100%; height: 100px; margin-bottom: 10px; font-size: 12px; font-family: monospace;">${newKey}</textarea>
      <div style="text-align: right;">
        <button onclick="this.parentElement.parentElement.remove()" style="padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
      </div>
    `;

    document.body.appendChild(copyDialog);

    // 自动选择文本
    const textarea = copyDialog.querySelector('textarea');
    textarea.focus();
    textarea.select();

    // 10秒后自动关闭
    setTimeout(() => {
      if (copyDialog.parentNode) {
        copyDialog.remove();
      }
    }, 10000);

    setSnackbar({
      open: true,
      message: '自动复制失败，请手动复制',
      severity: 'warning'
    });
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            API Keys管理
          </Typography>
          <Box>
            <IconButton onClick={fetchApiKeys} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              生成新的API Key
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>名称</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell>权限</TableCell>
                  <TableCell>速率限制</TableCell>
                  <TableCell>使用次数</TableCell>
                  <TableCell>最后使用</TableCell>
                  <TableCell>过期时间</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <KeyIcon fontSize="small" />
                        <Typography variant="body2" fontWeight="bold">
                          {key.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{key.description || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {key.permissions?.map((perm) => (
                          <Chip
                            key={perm}
                            label={perm}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>{key.rateLimit}/小时</TableCell>
                    <TableCell>{key.usageCount || 0}</TableCell>
                    <TableCell>
                      {key.lastUsed
                        ? format(new Date(key.lastUsed), 'yyyy-MM-dd HH:mm')
                        : '从未使用'}
                    </TableCell>
                    <TableCell>
                      {key.expiresAt
                        ? format(new Date(key.expiresAt), 'yyyy-MM-dd')
                        : '永不过期'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={key.isActive}
                        onChange={() => handleToggleActive(key.id, key.isActive)}
                        color="primary"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={() => handleDeleteKey(key.id)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {apiKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="textSecondary">
                        还没有API Key
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* 创建API Key对话框 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>生成新的API Key</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="名称"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="描述"
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>权限</InputLabel>
              <Select
                multiple
                value={formData.permissions}
                onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {availablePermissions.map((perm) => (
                  <MenuItem key={perm.value} value={perm.value}>
                    {perm.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="速率限制（每小时请求数）"
              type="number"
              value={formData.rateLimit}
              onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>有效期</InputLabel>
              <Select
                value={formData.expiresIn}
                onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value })}
              >
                <MenuItem value="never">永不过期</MenuItem>
                <MenuItem value="7days">7天</MenuItem>
                <MenuItem value="30days">30天</MenuItem>
                <MenuItem value="90days">90天</MenuItem>
                <MenuItem value="1year">1年</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>取消</Button>
          <Button
            onClick={handleGenerateKey}
            variant="contained"
            disabled={!formData.name}
          >
            生成
          </Button>
        </DialogActions>
      </Dialog>

      {/* 显示新生成的API Key */}
      <Dialog open={newKeyDialog} onClose={() => setNewKeyDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon />
            API Key已生成
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            请立即复制并保存此API Key。关闭此对话框后，您将无法再次查看完整的Key。
          </Alert>
          <Paper sx={{ p: 2, bgcolor: 'grey.100', position: 'relative' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {newKey}
            </Typography>
            <IconButton
              sx={{ position: 'absolute', top: 8, right: 8 }}
              onClick={handleCopyKey}
            >
              <CopyIcon />
            </IconButton>
          </Paper>
          <Typography variant="body2" sx={{ mt: 2 }}>
            使用方法：
          </Typography>
          <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
            <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
{`# 在请求头中使用
curl -H "X-API-Key: ${newKey}" ${API_BASE_URL}/api/commands/execute

# 或者在Authorization头中使用
curl -H "Authorization: Bearer ${newKey}" ${API_BASE_URL}/api/commands/execute`}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCopyKey} startIcon={<CopyIcon />}>
            复制
          </Button>
          <Button onClick={() => setNewKeyDialog(false)} variant="contained">
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default ApiKeys;