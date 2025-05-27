'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/utils/auth-store'

const GoogleCallbackPage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuthStore()
  const [status, setStatus] = useState('Processing...')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        setStatus('Authentication failed. Redirecting...')
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      if (!code) {
        setStatus('No authorization code received. Redirecting...')
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      try {
        setStatus('Completing authentication...')
        
        const response = await fetch('http://localhost:8000/admin/auth/oauth/google/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        })

        if (response.ok) {
          const data = await response.json()
          login(data.access_token, data.user)
          
          setStatus('Success! Redirecting...')
          
          // Redirect based on user role
          if (data.user.is_admin) {
            router.push('/admin')
          } else {
            router.push('/')
          }
        } else {
          const errorData = await response.json()
          setStatus(`Authentication failed: ${errorData.detail}`)
          setTimeout(() => router.push('/login'), 3000)
        }
      } catch (error) {
        console.error('OAuth callback error:', error)
        setStatus('Network error. Please try again.')
        setTimeout(() => router.push('/login'), 3000)
      }
    }

    handleCallback()
  }, [searchParams, router, login])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Google Authentication
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {status}
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoogleCallbackPage 