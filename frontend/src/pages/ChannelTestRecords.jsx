import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Box,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Chip,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  RestartAlt as ResetIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';

const ChannelTestRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchEmail, setSearchEmail] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [minFailures, setMinFailures] = useState('');
  const [stats, setStats] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, channelId: null });
  const [resetDialog, setResetDialog] = useState({ open: false, channelId: null });

  const fetchRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: page + 1,
        pageSize: rowsPerPage,
        ...(searchEmail && { accountEmail: searchEmail }),
        ...(filterStatus && { status: filterStatus }),
        ...(minFailures && { minFailures })
      };

      const response = await axios.get('/api/channel-test-records', { params });

      if (response.data.success) {
        setRecords(response.data.data.records);
        setTotalCount(response.data.data.pagination.total);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/channel-test-records/stats/summary');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [page, rowsPerPage]);

  const handleSearch = () => {
    setPage(0);
    fetchRecords();
  };

  const handleReset = async (channelId) => {
    try {
      const response = await axios.post(`/api/channel-test-records/${channelId}/reset`);
      if (response.data.success) {
        fetchRecords();
        fetchStats();
        setResetDialog({ open: false, channelId: null });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset record');
    }
  };

  const handleDelete = async (channelId) => {
    try {
      const response = await axios.delete(`/api/channel-test-records/${channelId}`);
      if (response.data.success) {
        fetchRecords();
        fetchStats();
        setDeleteDialog({ open: false, channelId: null });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete record');
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'success':
        return <Chip label="成功" size="small" color="success" icon={<SuccessIcon />} />;
      case 'failed':
        return <Chip label="失败" size="small" color="error" icon={<ErrorIcon />} />;
      case 'quota_exceeded':
        return <Chip label="配额超限" size="small" color="warning" icon={<WarningIcon />} />;
      default:
        return <Chip label="未测试" size="small" />;
    }
  };

  const getFailureCountChip = (count) => {
    if (count === 0) {
      return <Chip label="0" size="small" color="default" />;
    } else if (count === 1) {
      return <Chip label={`${count} 次`} size="small" color="warning" />;
    } else {
      return <Chip label={`${count} 次`} size="small" color="error" icon={<WarningIcon />} />;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          渠道测试记录
        </Typography>
        <Typography variant="body2" color="text.secondary">
          监控系统对每个渠道的测试记录和失败次数统计
        </Typography>
      </Box>

      {/* 统计卡片 */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  总记录数
                </Typography>
                <Typography variant="h4">
                  {stats.summary.totalRecords}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  失败渠道
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.summary.failedChannels}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  已禁用渠道
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.summary.disabledChannels}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  高失败率 (≥2次)
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.summary.highFailureChannels}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 搜索栏 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="搜索邮箱"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>状态</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="状态"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="success">成功</MenuItem>
                <MenuItem value="failed">失败</MenuItem>
                <MenuItem value="quota_exceeded">配额超限</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="最小失败次数"
              type="number"
              value={minFailures}
              onChange={(e) => setMinFailures(e.target.value)}
              InputProps={{ inputProps: { min: 0 } }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
            >
              搜索
            </Button>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                fetchRecords();
                fetchStats();
              }}
              startIcon={<RefreshIcon />}
            >
              刷新
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 数据表格 */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>渠道ID</TableCell>
                  <TableCell>渠道名称</TableCell>
                  <TableCell>账号邮箱</TableCell>
                  <TableCell align="center">失败次数</TableCell>
                  <TableCell align="center">最后状态</TableCell>
                  <TableCell>最后测试时间</TableCell>
                  <TableCell>最后测试消息</TableCell>
                  <TableCell align="center">是否禁用</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow
                    key={record.id}
                    sx={{
                      backgroundColor: record.failureCount >= 2 ? 'error.lighter' : 'inherit',
                      '&:hover': {
                        backgroundColor: record.failureCount >= 2 ? 'error.light' : 'action.hover'
                      }
                    }}
                  >
                    <TableCell>{record.channelId}</TableCell>
                    <TableCell>{record.channelName || '-'}</TableCell>
                    <TableCell>{record.accountEmail}</TableCell>
                    <TableCell align="center">
                      {getFailureCountChip(record.failureCount)}
                    </TableCell>
                    <TableCell align="center">
                      {getStatusChip(record.lastTestStatus)}
                    </TableCell>
                    <TableCell>
                      {record.lastTestTime
                        ? format(new Date(record.lastTestTime), 'yyyy-MM-dd HH:mm:ss')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={record.lastTestMessage || '-'}>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {record.lastTestMessage || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      {record.isDisabled ? (
                        <Chip label="已禁用" size="small" color="error" icon={<BlockIcon />} />
                      ) : (
                        <Chip label="正常" size="small" color="default" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="重置失败次数">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setResetDialog({ open: true, channelId: record.channelId })}
                        >
                          <ResetIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除记录">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteDialog({ open: true, channelId: record.channelId })}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </TableContainer>

      {/* 账号统计 */}
      {stats && stats.accountStats && stats.accountStats.length > 0 && (
        <Paper sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            账号统计
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>账号邮箱</TableCell>
                <TableCell align="center">总渠道数</TableCell>
                <TableCell align="center">高失败率渠道数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.accountStats.map((stat) => (
                <TableRow key={stat.accountEmail}>
                  <TableCell>{stat.accountEmail}</TableCell>
                  <TableCell align="center">{stat.totalChannels}</TableCell>
                  <TableCell align="center">
                    {stat.highFailureCount > 0 ? (
                      <Chip label={stat.highFailureCount} size="small" color="error" />
                    ) : (
                      stat.highFailureCount
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* 重置确认对话框 */}
      <Dialog
        open={resetDialog.open}
        onClose={() => setResetDialog({ open: false, channelId: null })}
      >
        <DialogTitle>确认重置</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要重置渠道 {resetDialog.channelId} 的失败次数吗？这将清零失败计数。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialog({ open: false, channelId: null })}>
            取消
          </Button>
          <Button onClick={() => handleReset(resetDialog.channelId)} color="primary">
            确认重置
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, channelId: null })}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除渠道 {deleteDialog.channelId} 的测试记录吗？此操作不可恢复。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, channelId: null })}>
            取消
          </Button>
          <Button onClick={() => handleDelete(deleteDialog.channelId)} color="error">
            确认删除
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ChannelTestRecords;