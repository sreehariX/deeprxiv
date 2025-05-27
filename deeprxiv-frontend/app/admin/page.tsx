'use client'

import React, { useEffect, useState } from 'react'
import { useAuthStore } from '@/utils/auth-store'
import { analyticsApi } from '@/utils/admin-api'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Star, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface OverviewData {
  overview: {
    total_users: number
    new_users_period: number
    total_papers: number
    processed_papers: number
    total_chats: number
    active_chats_period: number
    total_messages: number
    messages_period: number
    total_feedback: number
    pending_feedback: number
    total_page_views: number
    page_views_period: number
    error_rate: number
    avg_response_time: number
  }
  period_days: number
}

const AdminDashboard = () => {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.is_admin) {
      router.push('/login')
      return
    }

    fetchOverview()
  }, [isAuthenticated, user, router])

  const fetchOverview = async () => {
    try {
      setLoading(true)
      const response = await analyticsApi.getOverview(30)
      setOverview(response.data)
    } catch (error) {
      console.error('Error fetching overview:', error)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated || !user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You need admin privileges to access this page.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={fetchOverview}>Retry</Button>
        </div>
      </div>
    )
  }

  const stats = overview?.overview

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user.full_name || user.email}</p>
            </div>
            <div className="flex space-x-4">
              <Link href="/admin/users">
                <Button variant="outline">Manage Users</Button>
              </Link>
              <Link href="/admin/feedback">
                <Button variant="outline">View Feedback</Button>
              </Link>
              <Link href="/admin/analytics">
                <Button>Detailed Analytics</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                <p className="text-2xl font-bold text-gray-900">{stats?.total_users || 0}</p>
                <p className="text-sm text-green-600">+{stats?.new_users_period || 0} this month</p>
              </div>
            </div>
          </div>

          {/* Papers */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Papers</h3>
                <p className="text-2xl font-bold text-gray-900">{stats?.total_papers || 0}</p>
                <p className="text-sm text-blue-600">{stats?.processed_papers || 0} processed</p>
              </div>
            </div>
          </div>

          {/* Chats */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Chat Sessions</h3>
                <p className="text-2xl font-bold text-gray-900">{stats?.total_chats || 0}</p>
                <p className="text-sm text-green-600">{stats?.active_chats_period || 0} active</p>
              </div>
            </div>
          </div>

          {/* Feedback */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Feedback</h3>
                <p className="text-2xl font-bold text-gray-900">{stats?.total_feedback || 0}</p>
                <p className="text-sm text-orange-600">{stats?.pending_feedback || 0} pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold">Page Views</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.total_page_views || 0}</p>
            <p className="text-sm text-gray-600">
              +{stats?.page_views_period || 0} in last {overview?.period_days} days
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold">Error Rate</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.error_rate || 0}%</p>
            <p className="text-sm text-gray-600">System error rate</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Clock className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold">Response Time</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.avg_response_time || 0}s</p>
            <p className="text-sm text-gray-600">Average response time</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/users" className="block">
              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Users className="h-8 w-8 text-blue-600 mb-2" />
                <h4 className="font-medium">Manage Users</h4>
                <p className="text-sm text-gray-600">View and edit user accounts</p>
              </div>
            </Link>

            <Link href="/admin/feedback" className="block">
              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <MessageSquare className="h-8 w-8 text-green-600 mb-2" />
                <h4 className="font-medium">Review Feedback</h4>
                <p className="text-sm text-gray-600">Respond to user feedback</p>
              </div>
            </Link>

            <Link href="/admin/analytics" className="block">
              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
                <h4 className="font-medium">View Analytics</h4>
                <p className="text-sm text-gray-600">Detailed usage statistics</p>
              </div>
            </Link>

            <Link href="/admin/settings" className="block">
              <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <CheckCircle className="h-8 w-8 text-orange-600 mb-2" />
                <h4 className="font-medium">System Settings</h4>
                <p className="text-sm text-gray-600">Configure system settings</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard 