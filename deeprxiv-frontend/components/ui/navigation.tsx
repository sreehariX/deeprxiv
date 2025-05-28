'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import UserDropdown from './user-dropdown'
import Image from 'next/image'

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      setIsScrolled(scrollTop > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'top-4' 
        : 'top-0'
    }`}>
      <div className={`mx-auto transition-all duration-300 ${
        isScrolled 
          ? 'max-w-6xl px-4' 
          : 'max-w-8xl px-4 sm:px-6 lg:px-8'
      }`}>
        <div className={`transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200/70 dark:border-gray-700/70 shadow-lg rounded-2xl' 
            : 'bg-white/10 dark:bg-gray-900/10 backdrop-blur-sm border border-gray-200/10 dark:border-gray-700/10 rounded-2xl'
        }`}>
          <div className="flex justify-between items-center h-16 px-6">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                <div className={`w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg p-1.5 transition-all duration-300 ${
                  isScrolled ? 'opacity-100' : 'opacity-80'
                }`}>
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
                    <path fillRule="evenodd" clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor"></path>
                  </svg>
                </div>
                <span className={`text-xl font-bold transition-all duration-300 ${
                  isScrolled 
                    ? 'text-gray-900 dark:text-white' 
                    : 'text-gray-900 dark:text-gray-200'
                }`}>DeepRxiv</span>
              </Link>
            </div>

            {/* Right side container for navigation and user dropdown */}
            <div className="flex items-center space-x-8">
              {/* Navigation Links */}
              <div className="hidden md:flex items-center space-x-6">
                <Link
                  href="/"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isScrolled
                      ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'text-gray-900 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white hover:bg-white/10 dark:hover:bg-gray-800/50'
                  }`}
                >
                  Home
                </Link>
                <Link
                  href="/papers"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isScrolled
                      ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'text-gray-900 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white hover:bg-white/10 dark:hover:bg-gray-800/50'
                  }`}
                >
                  Papers
                </Link>
                <Link
                  href="/chat"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isScrolled
                      ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'text-gray-900 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white hover:bg-white/10 dark:hover:bg-gray-800/50'
                  }`}
                >
                  Chat
                </Link>
              </div>

              {/* User Dropdown */}
              <div className="flex items-center">
                <UserDropdown />
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className={`md:hidden border-t transition-all duration-300 ${
            isScrolled
              ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50 rounded-b-2xl'
              : 'bg-white/20 dark:bg-gray-900/20 backdrop-blur-sm border-gray-200/20 dark:border-gray-700/20 rounded-b-2xl'
          }`}>
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                href="/"
                className={`block px-3 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
                  isScrolled
                    ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    : 'text-gray-900 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white hover:bg-white/10 dark:hover:bg-gray-800/50'
                }`}
              >
                Home
              </Link>
              <Link
                href="/papers"
                className={`block px-3 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
                  isScrolled
                    ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    : 'text-gray-900 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white hover:bg-white/10 dark:hover:bg-gray-800/50'
                }`}
              >
                Papers
              </Link>
              <Link
                href="/chat"
                className={`block px-3 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
                  isScrolled
                    ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    : 'text-gray-900 dark:text-gray-200 hover:text-gray-700 dark:hover:text-white hover:bg-white/10 dark:hover:bg-gray-800/50'
                }`}
              >
                Chat
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation 