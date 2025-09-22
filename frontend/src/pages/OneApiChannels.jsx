import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Tooltip,
  Checkbox,
  Tabs,
  Tab
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  Speed as SpeedIcon,
  BugReport as TestIcon,
  Assessment as StatsIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  FolderOpen as FolderIcon,
  AutorenewOutlined as MonitorIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const OneApiChannels = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    group: '',
    model: '',
    status: 'enabled'
  });
  const [testingChannels, setTestingChannels] = useState(new Set());
  const [selectedChannels, setSelectedChannels] = useState(new Set());
  const [statsDialog, setStatsDialog] = useState(false);
  const [stats, setStats] = useState(null);
  const [testModel, setTestModel] = useState('');
  const [addChannelDialog, setAddChannelDialog] = useState(false);
  const [channelType, setChannelType] = useState('gemini');
  const [newChannel, setNewChannel] = useState({
    name: '',
    key: ''
  });
  const [monitorDialog, setMonitorDialog] = useState(false);
  const [monitorLogs, setMonitorLogs] = useState([]);
  const [monitorStats, setMonitorStats] = useState(null);
  const [monitorStatus, setMonitorStatus] = useState(null);

  // 加载渠道列表
  const loadChannels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/oneapi/channels', {
        params: {
          page: page + 1,
          pageSize: rowsPerPage,
          status: searchParams.status
        }
      });

      if (response.data.success) {
        setChannels(response.data.data.items || []);
        setTotal(response.data.data.total || 0);
      } else {
        toast.error(response.data.message || '获取渠道列表失败');
      }
    } catch (error) {
      toast.error('获取渠道列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 搜索渠道
  const searchChannels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/oneapi/channels/search', {
        params: {
          ...searchParams,
          page: page + 1,
          pageSize: rowsPerPage
        }
      });

      if (response.data.success) {
        setChannels(response.data.data.items || []);
        setTotal(response.data.data.total || 0);
      } else {
        toast.error(response.data.message || '搜索渠道失败');
      }
    } catch (error) {
      toast.error('搜索渠道失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 测试单个渠道
  const testChannel = async (channelId, channelName) => {
    setTestingChannels(prev => new Set([...prev, channelId]));

    try {
      const response = await api.post('/oneapi/channels/test', {
        channelId,
        model: testModel
      });

      if (response.data.success) {
        toast.success(`渠道 ${channelName} 测试通过 (${response.data.time}ms)`);
      } else {
        toast.error(`渠道 ${channelName} 测试失败: ${response.data.message}`);
      }

      // 刷新列表以更新状态
      loadChannels();
    } catch (error) {
      toast.error(`测试渠道 ${channelName} 失败: ${error.message}`);
    } finally {
      setTestingChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  // 批量测试渠道
  const batchTestChannels = async () => {
    if (selectedChannels.size === 0) {
      toast.warning('请先选择要测试的渠道');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/oneapi/channels/batch-test', {
        channelIds: Array.from(selectedChannels),
        model: testModel
      });

      if (response.data.success) {
        const results = response.data.results;
        const passed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        toast.info(`批量测试完成: ${passed} 个通过, ${failed} 个失败`);

        // 显示详细结果
        results.forEach(result => {
          const channel = channels.find(c => c.id === result.channelId);
          if (channel) {
            if (result.success) {
              toast.success(`${channel.name} 测试通过 (${result.time}ms)`, {
                autoClose: 3000
              });
            } else {
              toast.error(`${channel.name} 测试失败: ${result.message}`, {
                autoClose: 5000
              });
            }
          }
        });

        // 刷新列表
        loadChannels();
      }
    } catch (error) {
      toast.error('批量测试失败: ' + error.message);
    } finally {
      setLoading(false);
      setSelectedChannels(new Set());
    }
  };

  // 获取统计信息
  const loadStats = async () => {
    try {
      const response = await api.get('/oneapi/stats');

      if (response.data.success) {
        setStats(response.data.stats);
        setStatsDialog(true);
      }
    } catch (error) {
      toast.error('获取统计信息失败: ' + error.message);
    }
  };

  // 选择/取消选择渠道
  const handleSelectChannel = (channelId) => {
    setSelectedChannels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
      }
      return newSet;
    });
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedChannels.size === channels.length) {
      setSelectedChannels(new Set());
    } else {
      setSelectedChannels(new Set(channels.map(c => c.id)));
    }
  };

  // 创建渠道
  const handleCreateChannel = async () => {
    if (!newChannel.name || !newChannel.key) {
      toast.warning('请填写渠道名称和密钥');
      return;
    }

    setLoading(true);
    try {
      const endpoint = channelType === 'gemini' ? '/oneapi/channels/gemini' : '/oneapi/channels/vertex';
      const response = await api.post(endpoint, newChannel);

      if (response.data.success) {
        toast.success(response.data.message || `${channelType === 'gemini' ? 'Gemini' : 'Vertex'}渠道创建成功`);
        setAddChannelDialog(false);
        setNewChannel({ name: '', key: '' });
        loadChannels();
      } else {
        toast.error(response.data.message || '创建渠道失败');
      }
    } catch (error) {
      toast.error('创建渠道失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载监控状态和日志
  const loadMonitorData = async () => {
    try {
      // 获取监控状态
      const statusResponse = await api.get('/oneapi/monitor/status');
      if (statusResponse.data) {
        setMonitorStatus(statusResponse.data);
      }

      // 获取监控日志
      const logsResponse = await api.get('/oneapi/monitor/logs');
      if (logsResponse.data.success) {
        // 注意: 后端返回的是 data.data.logs 结构
        setMonitorLogs(logsResponse.data.data?.logs || []);
      }

      // 获取监控统计
      const statsResponse = await api.get('/oneapi/monitor/stats');
      if (statsResponse.data.success) {
        setMonitorStats(statsResponse.data.stats);
      }

      setMonitorDialog(true);
    } catch (error) {
      toast.error('获取监控信息失败: ' + error.message);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [page, rowsPerPage]);

  // 获取渠道类型名称
  const getChannelTypeName = (type) => {
    const typeNames = {
      41: 'Vertex AI',
      1: 'OpenAI',
      2: 'Claude',
      3: 'Azure',
      // 添加更多类型映射
    };
    return typeNames[type] || `Type ${type}`;
  };

  // 格式化模型列表
  const formatModels = (models) => {
    if (!models) return '无';
    const modelList = models.split(',');
    if (modelList.length > 3) {
      return `${modelList.slice(0, 3).join(', ')}... (${modelList.length}个)`;
    }
    return models;
  };

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            OneAPI 渠道管理
          </Typography>
          <Box>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddChannelDialog(true)}
              sx={{ mr: 1 }}
              color="success"
            >
              添加渠道
            </Button>
            <Button
              startIcon={<MonitorIcon />}
              onClick={loadMonitorData}
              sx={{ mr: 1 }}
              color="info"
            >
              文件监控
            </Button>
            <Button
              startIcon={<StatsIcon />}
              onClick={loadStats}
              sx={{ mr: 1 }}
            >
              统计信息
            </Button>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={loadChannels}
              disabled={loading}
            >
              刷新
            </Button>
          </Box>
        </Box>

        {/* 搜索栏 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="关键词"
              value={searchParams.keyword}
              onChange={(e) => setSearchParams({ ...searchParams, keyword: e.target.value })}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="分组"
              value={searchParams.group}
              onChange={(e) => setSearchParams({ ...searchParams, group: e.target.value })}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="模型"
              value={searchParams.model}
              onChange={(e) => setSearchParams({ ...searchParams, model: e.target.value })}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>状态</InputLabel>
              <Select
                value={searchParams.status}
                label="状态"
                onChange={(e) => setSearchParams({ ...searchParams, status: e.target.value })}
              >
                <MenuItem value="enabled">启用</MenuItem>
                <MenuItem value="disabled">禁用</MenuItem>
                <MenuItem value="all">全部</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={searchChannels}
              disabled={loading}
            >
              搜索
            </Button>
          </Grid>
        </Grid>

        {/* 批量操作栏 */}
        {selectedChannels.size > 0 && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Grid container alignItems="center" spacing={2}>
              <Grid item>
                <Typography variant="body2">
                  已选择 {selectedChannels.size} 个渠道
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="测试模型（可选）"
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  size="small"
                  placeholder="留空使用默认模型"
                />
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<TestIcon />}
                  onClick={batchTestChannels}
                  disabled={loading}
                >
                  批量测试
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* 渠道列表 */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={channels.length > 0 && selectedChannels.size === channels.length}
                    indeterminate={selectedChannels.size > 0 && selectedChannels.size < channels.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>ID</TableCell>
                <TableCell>名称</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>分组</TableCell>
                <TableCell>模型</TableCell>
                <TableCell>响应时间</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && channels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : channels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="textSecondary">暂无渠道数据</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedChannels.has(channel.id)}
                        onChange={() => handleSelectChannel(channel.id)}
                      />
                    </TableCell>
                    <TableCell>{channel.id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {channel.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getChannelTypeName(channel.type)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={channel.status === 1 ? <CheckCircleIcon /> : <ErrorIcon />}
                        label={channel.status === 1 ? '启用' : '禁用'}
                        size="small"
                        color={channel.status === 1 ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      {channel.group ? (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {channel.group.split(',').map((g, i) => (
                            <Chip key={i} label={g} size="small" />
                          ))}
                        </Box>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={channel.models || '无'}>
                        <Typography variant="body2" sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatModels(channel.models)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {channel.response_time > 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <SpeedIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {channel.response_time}ms
                          </Typography>
                        </Box>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="测试渠道">
                        <IconButton
                          size="small"
                          onClick={() => testChannel(channel.id, channel.name)}
                          disabled={testingChannels.has(channel.id)}
                        >
                          {testingChannels.has(channel.id) ? (
                            <CircularProgress size={20} />
                          ) : (
                            <TestIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 分页 */}
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="每页显示"
        />
      </Paper>

      {/* 添加渠道对话框 */}
      <Dialog open={addChannelDialog} onClose={() => setAddChannelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加渠道</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Tabs
              value={channelType}
              onChange={(e, value) => setChannelType(value)}
              sx={{ mb: 3 }}
            >
              <Tab label="Gemini" value="gemini" />
              <Tab label="Vertex" value="vertex" />
            </Tabs>

            <TextField
              fullWidth
              label="渠道名称"
              value={newChannel.name}
              onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
              sx={{ mb: 2 }}
              placeholder={`输入${channelType === 'gemini' ? 'Gemini' : 'Vertex'}渠道名称`}
            />

            <TextField
              fullWidth
              label="API密钥"
              value={newChannel.key}
              onChange={(e) => setNewChannel({ ...newChannel, key: e.target.value })}
              multiline
              rows={3}
              placeholder={channelType === 'gemini' ? '输入Gemini API Key' : '输入Vertex服务账号JSON内容'}
              helperText={
                channelType === 'gemini'
                  ? 'Gemini API Key，格式：AIzaSy...'
                  : 'Vertex服务账号JSON内容，包含project_id、private_key等'
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddChannelDialog(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreateChannel}
            disabled={loading || !newChannel.name || !newChannel.key}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* 统计信息对话框 */}
      <Dialog open={statsDialog} onClose={() => setStatsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>渠道统计信息</DialogTitle>
        <DialogContent>
          {stats && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      总体统计
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Typography variant="h6">{stats.total}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          总渠道数
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="h6" color="success.main">
                          {stats.enabled}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          已启用
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="h6" color="error.main">
                          {stats.disabled}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          已禁用
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {Object.keys(stats.types).length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        类型分布
                      </Typography>
                      {Object.entries(stats.types).map(([type, count]) => (
                        <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">
                            {type.replace('type_', 'Type ')}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {count}
                          </Typography>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {Object.keys(stats.groups).length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        分组分布
                      </Typography>
                      {Object.entries(stats.groups).map(([group, count]) => (
                        <Box key={group} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">{group}</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {count}
                          </Typography>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 文件监控对话框 */}
      <Dialog open={monitorDialog} onClose={() => setMonitorDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">文件监控日志</Typography>
            {monitorStatus && (
              <Chip
                label={monitorStatus.isRunning ? '监控中' : '已停止'}
                color={monitorStatus.isRunning ? 'success' : 'default'}
                icon={monitorStatus.isRunning ? <CheckCircleIcon /> : <ErrorIcon />}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* 监控统计 */}
          {monitorStats && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                监控统计
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        总处理数
                      </Typography>
                      <Typography variant="h4">
                        {monitorStats.total || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        成功
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {monitorStats.success || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        失败
                      </Typography>
                      <Typography variant="h4" color="error.main">
                        {monitorStats.failed || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        待处理
                      </Typography>
                      <Typography variant="h4" color="warning.main">
                        {monitorStats.pending || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* 监控信息 */}
          {monitorStatus && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    监控目录
                  </Typography>
                  <Typography variant="body1">
                    {monitorStatus.monitorPath}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    轮询间隔
                  </Typography>
                  <Typography variant="body1">
                    {monitorStatus.interval / 1000} 秒
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    状态
                  </Typography>
                  <Typography variant="body1">
                    {monitorStatus.isRunning ? '运行中' : '已停止'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* 处理日志表格 */}
          <Typography variant="subtitle1" gutterBottom>
            处理日志
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>文件名</TableCell>
                  <TableCell>渠道名称</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>尝试次数</TableCell>
                  <TableCell>消息</TableCell>
                  <TableCell>处理时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monitorLogs.length > 0 ? (
                  monitorLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <FolderIcon sx={{ mr: 1, fontSize: 18, color: 'action.active' }} />
                          {log.fileName}
                        </Box>
                      </TableCell>
                      <TableCell>{log.channelName}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.channelType}
                          size="small"
                          color={log.channelType === 'gemini' ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.status}
                          size="small"
                          color={
                            log.status === 'success' ? 'success' :
                            log.status === 'failed' ? 'error' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell>{log.attempts}</TableCell>
                      <TableCell>
                        <Tooltip title={log.message || '无'}>
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.message || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{new Date(log.processedAt).toLocaleString('zh-CN')}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      暂无处理日志
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMonitorDialog(false); loadMonitorData(); }} startIcon={<RefreshIcon />}>
            刷新
          </Button>
          <Button onClick={() => setMonitorDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OneApiChannels;