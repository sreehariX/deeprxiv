'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/utils/auth-store'

const GitHubCallbackPage = () => {
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
        
        const response = await fetch('http://localhost:8000/admin/auth/oauth/github/callback', {
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
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-900 mb-4">
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              GitHub Authentication
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {status}
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GitHubCallbackPage 