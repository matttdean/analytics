'use client'

import { useState } from 'react'
import { FileText, Plus, Calendar, Download, Share2, Edit, Trash2, Eye, Clock, BarChart3, TrendingUp, Users, Target, Search, Building2 } from 'lucide-react'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('saved')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Mock saved reports
  const savedReports = [
    {
      id: 1,
      name: 'Weekly Performance Summary',
      description: 'Comprehensive overview of website performance metrics',
      type: 'Performance',
      schedule: 'Weekly',
      lastRun: '2025-08-28',
      nextRun: '2025-09-04',
      status: 'active',
      recipients: ['team@deandesign.co', 'stakeholders@deandesign.co']
    },
    {
      id: 2,
      name: 'Monthly SEO Report',
      description: 'Search engine optimization performance and rankings',
      type: 'SEO',
      schedule: 'Monthly',
      lastRun: '2025-08-01',
      nextRun: '2025-09-01',
      status: 'active',
      recipients: ['seo@deandesign.co']
    },
    {
      id: 3,
      name: 'Conversion Funnel Analysis',
      description: 'Detailed breakdown of user conversion journey',
      type: 'Analytics',
      schedule: 'Bi-weekly',
      lastRun: '2025-08-15',
      nextRun: '2025-08-29',
      status: 'paused',
      recipients: ['marketing@deandesign.co']
    }
  ]

  // Mock report templates
  const reportTemplates = [
    {
      id: 1,
      name: 'Executive Summary',
      description: 'High-level overview for stakeholders',
      icon: BarChart3,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 2,
      name: 'Marketing Performance',
      description: 'Campaign effectiveness and ROI metrics',
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 3,
      name: 'User Behavior Analysis',
      description: 'Detailed user journey and engagement',
      icon: Users,
      color: 'from-purple-500 to-violet-500'
    },
    {
      id: 4,
      name: 'SEO Performance',
      description: 'Search rankings and organic traffic',
      icon: Search,
      color: 'from-orange-500 to-amber-500'
    },
    {
      id: 5,
      name: 'Business Profile Insights',
      description: 'Google Business Profile performance',
      icon: Building2,
      color: 'from-red-500 to-pink-500'
    },
    {
      id: 6,
      name: 'Conversion Optimization',
      description: 'Goal tracking and conversion rates',
      icon: Target,
      color: 'from-teal-500 to-cyan-500'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'paused': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Performance': return <BarChart3 className="h-4 w-4" />
      case 'SEO': return <Search className="h-4 w-4" />
      case 'Analytics': return <TrendingUp className="h-4 w-4" />
      case 'Marketing': return <Target className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-slate-600 to-gray-600 flex items-center justify-center">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        </div>
        <p className="text-gray-600">Create, schedule, and manage custom reports</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Report
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          <Download className="h-4 w-4" />
          Export All
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <div className="flex gap-6 border-b">
          <button
            onClick={() => setActiveTab('saved')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'saved'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Saved Reports ({savedReports.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'templates'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Templates ({reportTemplates.length})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'scheduled'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Scheduled
          </button>
        </div>

        {/* Saved Reports Tab */}
        {activeTab === 'saved' && (
          <div className="mt-6">
            <div className="space-y-4">
              {savedReports.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(report.type)}
                          <span className="text-sm font-medium text-gray-900">{report.name}</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                          {report.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {report.schedule}
                        </span>
                        <span>Last run: {report.lastRun}</span>
                        <span>Next run: {report.nextRun}</span>
                        <span>{report.recipients.length} recipients</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <Download className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reportTemplates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className={`h-12 w-12 rounded-lg bg-gradient-to-r ${template.color} flex items-center justify-center mb-3`}>
                    <template.icon className="h-6 w-6 text-white" />
                  </div>
                  
                  <h4 className="font-medium text-gray-900 mb-1">{template.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  
                  <button className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors">
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Tab */}
        {activeTab === 'scheduled' && (
          <div className="mt-6">
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No scheduled reports at the moment</p>
              <p className="text-sm">Create a report and set up scheduling to see them here</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        
        <div className="grid gap-4 md:grid-cols-3">
          <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Share2 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900">Share Report</div>
              <div className="text-sm text-gray-600">Send to team members</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900">Schedule Report</div>
              <div className="text-sm text-gray-600">Set up automatic delivery</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Download className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900">Export Data</div>
              <div className="text-sm text-gray-600">Download in various formats</div>
            </div>
          </button>
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Report</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter report name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe what this report covers"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Performance</option>
                  <option>SEO</option>
                  <option>Analytics</option>
                  <option>Marketing</option>
                  <option>Custom</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>No schedule</option>
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>Custom</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Create Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
