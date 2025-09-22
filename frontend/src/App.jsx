import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import GCloudAccounts from './pages/GCloudAccounts'
import Terminal from './pages/Terminal'
import History from './pages/History'
import ApiKeys from './pages/ApiKeys'
import OneApiChannels from './pages/OneApiChannels'
import ChannelTestRecords from './pages/ChannelTestRecords'
import PrivateRoute from './components/PrivateRoute'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accounts" element={<GCloudAccounts />} />
          <Route path="terminal" element={<Terminal />} />
          <Route path="history" element={<History />} />
          <Route path="apikeys" element={<ApiKeys />} />
          <Route path="channels" element={<OneApiChannels />} />
          <Route path="channel-test-records" element={<ChannelTestRecords />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App