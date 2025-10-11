import React, { useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  TextField,
  Button,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Pagination
} from '@mui/material'
import {
  AttachMoney as MoneyIcon,
  Analytics as AnalyticsIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { zhCN } from '@mui/x-date-pickers/locales'
import axios from 'axios'
import { toast } from 'react-toastify'

function AccountSummaries() {
  const [summaries, setSummaries] = useState([])
  const [filteredSummaries, setFilteredSummaries] = useState([])
  const [groupedSummaries, setGroupedSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    // 默认获取最近一周的数据
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    oneWeekAgo.setHours(0, 0, 0, 0)
    setStartDate(oneWeekAgo)

    const today = new Date()
    today.setHours(23, 59, 59, 999)
    setEndDate(today)

    fetchSummaries()
  }, [])

  const fetchSummaries = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/gcloud-accounts/summaries')

      if (response.data.success) {
        const sortedSummaries = response.data.summaries.sort((a, b) => {
          return new Date(b.accountCreatedAt) - new Date(a.accountCreatedAt)
        })
        setSummaries(sortedSummaries)
        setFilteredSummaries(sortedSummaries)
      } else {
        toast.error('获取账户汇总数据失败')
      }
    } catch (error) {
      console.error('Error fetching summaries:', error)
      toast.error('获取账户汇总数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 时间筛选和分组功能
  useEffect(() => {
    filterAndGroupSummaries()
  }, [summaries, startDate, endDate, page])

  const filterAndGroupSummaries = () => {
    let filtered = [...summaries]

    if (startDate) {
      filtered = filtered.filter(item => {
        if (!item.accountCreatedAt) return false
        const itemDate = new Date(item.accountCreatedAt)
        const filterDate = new Date(startDate)
        itemDate.setHours(0, 0, 0, 0)
        filterDate.setHours(0, 0, 0, 0)
        return itemDate >= filterDate
      })
    }

    if (endDate) {
      filtered = filtered.filter(item => {
        if (!item.accountCreatedAt) return false
        const itemDate = new Date(item.accountCreatedAt)
        const filterDate = new Date(endDate)
        itemDate.setHours(0, 0, 0, 0)
        filterDate.setHours(0, 0, 0, 0)
        return itemDate <= filterDate
      })
    }

    setFilteredSummaries(filtered)

    // 按天分组
    const grouped = {}
    filtered.forEach(item => {
      if (!item.accountCreatedAt) return
      const date = new Date(item.accountCreatedAt)
      const dateKey = date.toLocaleDateString('zh-CN')

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(item)
    })

    // 按日期排序分组
    const sortedGrouped = {}
    Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a))
      .forEach(key => {
        sortedGrouped[key] = grouped[key]
      })

    setGroupedSummaries(sortedGrouped)

    // 计算分页
    const totalItems = Object.keys(sortedGrouped).length
    setTotalPages(Math.ceil(totalItems / itemsPerPage))
  }

  const clearFilters = () => {
    // 重置为最近一周
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    oneWeekAgo.setHours(0, 0, 0, 0)
    setStartDate(oneWeekAgo)

    const today = new Date()
    today.setHours(23, 59, 59, 999)
    setEndDate(today)
    setPage(1)
  }

  // 计算整体统计数据
  const overallStatistics = {
    totalAccounts: filteredSummaries.length,
    totalAmount: filteredSummaries.reduce((sum, item) => sum + parseFloat(item.consumptionAmount || 0), 0),
    averageAmount: filteredSummaries.length > 0 ?
      filteredSummaries.reduce((sum, item) => sum + parseFloat(item.consumptionAmount || 0), 0) / filteredSummaries.length : 0
  }

  // 计算分组统计数据
  const getGroupStatistics = (groupItems) => {
    return {
      totalAccounts: groupItems.length,
      totalAmount: groupItems.reduce((sum, item) => sum + parseFloat(item.consumptionAmount || 0), 0),
      averageAmount: groupItems.length > 0 ?
        groupItems.reduce((sum, item) => sum + parseFloat(item.consumptionAmount || 0), 0) / groupItems.length : 0
    }
  }

  // 获取当前页的分组
  const getCurrentPageGroups = () => {
    const allGroups = Object.entries(groupedSummaries)
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return allGroups.slice(startIndex, endIndex)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}>
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">
            账户消费汇总
          </Typography>
        </Box>

        {/* 时间筛选器 */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" sx={{ minWidth: 'auto' }}>
              时间筛选：
            </Typography>
            <DateTimePicker
              label="开始日期"
              value={startDate}
              onChange={setStartDate}
              renderInput={(params) => (
                <TextField {...params} size="small" sx={{ minWidth: 200 }} />
              )}
              ampm={false}
              views={['year', 'month', 'day']}
            />
            <DateTimePicker
              label="结束日期"
              value={endDate}
              onChange={setEndDate}
              renderInput={(params) => (
                <TextField {...params} size="small" sx={{ minWidth: 200 }} />
              )}
              ampm={false}
              views={['year', 'month', 'day']}
            />
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={clearFilters}
              size="small"
            >
              重置为最近一周
            </Button>
          </Stack>
        </Paper>

        {/* 整体统计卡片 */}
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
          整体统计
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <AnalyticsIcon color="primary" />
                  <Typography variant="h6" color="primary">
                    总账户数
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>
                  {overallStatistics.totalAccounts}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  筛选范围内的账户总数
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <MoneyIcon color="success" />
                  <Typography variant="h6" color="success.main">
                    累计消费
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" sx={{ mt: 1, color: 'success.main' }}>
                  ${overallStatistics.totalAmount.toFixed(4)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  所有账户消费总和
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <MoneyIcon color="secondary" />
                  <Typography variant="h6" color="secondary.main">
                    平均消费
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" sx={{ mt: 1, color: 'secondary.main' }}>
                  ${overallStatistics.averageAmount.toFixed(4)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  平均每账户消费金额
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 按日期分组显示 */}
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          按日期分组显示
        </Typography>

        {Object.keys(groupedSummaries).length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              {summaries.length === 0 ? '暂无同步数据。请先在账户管理页面进行同步操作。' : '没有符合筛选条件的数据。'}
            </Typography>
          </Paper>
        ) : (
          <>
            {getCurrentPageGroups().map(([dateKey, groupItems]) => {
              const groupStats = getGroupStatistics(groupItems)
              return (
                <Accordion key={dateKey}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" fontWeight="bold">
                        {dateKey}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 4, mr: 2 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">账户数</Typography>
                          <Typography variant="h6" color="primary">{groupStats.totalAccounts}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">累计消费</Typography>
                          <Typography variant="h6" color="success.main">${groupStats.totalAmount.toFixed(4)}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">平均消费</Typography>
                          <Typography variant="h6" color="secondary.main">${groupStats.averageAmount.toFixed(4)}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>邮箱</TableCell>
                            <TableCell>消费金额</TableCell>
                            <TableCell>脚本执行次数</TableCell>
                            <TableCell>账号创建时间</TableCell>
                            <TableCell>最后监听时间</TableCell>
                            <TableCell>最后同步时间</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {groupItems.map((summary) => (
                            <TableRow key={summary.id}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {summary.email}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <MoneyIcon fontSize="small" color="success" />
                                  <Typography variant="body2" fontWeight="medium" color="success.main">
                                    ${parseFloat(summary.consumptionAmount || 0).toFixed(4)}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={summary.scriptExecutionCount || 0}
                                  size="small"
                                  color={
                                    (summary.scriptExecutionCount || 0) >= 4
                                      ? 'error'
                                      : (summary.scriptExecutionCount || 0) >= 3
                                        ? 'warning'
                                        : 'default'
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>
                                  {summary.accountCreatedAt ? (
                                    <>
                                      <div>{new Date(summary.accountCreatedAt).toLocaleDateString()}</div>
                                      <div>{new Date(summary.accountCreatedAt).toLocaleTimeString()}</div>
                                    </>
                                  ) : (
                                    'N/A'
                                  )}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>
                                  {summary.lastMonitorTime ? (
                                    <>
                                      <div>{new Date(summary.lastMonitorTime).toLocaleDateString()}</div>
                                      <div>{new Date(summary.lastMonitorTime).toLocaleTimeString()}</div>
                                    </>
                                  ) : (
                                    '从未监听'
                                  )}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>
                                  {summary.lastSyncTime ? (
                                    <>
                                      <div>{new Date(summary.lastSyncTime).toLocaleDateString()}</div>
                                      <div>{new Date(summary.lastSyncTime).toLocaleTimeString()}</div>
                                    </>
                                  ) : (
                                    '从未同步'
                                  )}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )
            })}

            {/* 分页控件 */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(event, value) => setPage(value)}
                  color="primary"
                  size="large"
                />
              </Box>
            )}
          </>
        )}
      </Container>
    </LocalizationProvider>
  )
}

export default AccountSummaries