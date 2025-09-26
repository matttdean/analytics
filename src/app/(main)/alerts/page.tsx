'use client'

import { useState } from 'react'
import { Bell, AlertTriangle, CheckCircle, Info, X, Settings, Plus, Filter, Search } from 'lucide-react'

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState('active')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Mock alerts data
  const alerts = [
    {
      id: 1,
      title: 'Performance Drop Detected',
      description: 'Website load time increased by 40% in the last 24 hours',
      type: 'performance',
      severity: 'high',
      status: 'active',
      timestamp: '2025-08-29 14:30',
      category: 'Performance',
      affectedMetrics: ['Load Time', 'Core Web Vitals'],
      actions: ['Investigate', 'Optimize Images', 'Check CDN']
    },
    {
      id: 2,
      title: 'Search Console Error',
      description: 'Failed to fetch data from Google Search Console API',
      type: 'error',
      severity: 'medium',
      status: 'active',
      timestamp: '2025-08-29 12:15',
      category: 'API',
      affectedMetrics: ['Search Queries', 'Click-through Rate'],
      actions: ['Check API Keys', 'Verify Permissions', 'Contact Support']
    },
    {
      id: 3,
      title: 'Traffic Spike Detected',
      description: 'Unusual increase in organic traffic - 150% above normal',
      type: 'info',
      severity: 'low',
      status: 'resolved',
      timestamp: '2025-08-28 09:45',
      category: 'Traffic',
      affectedMetrics: ['Organic Traffic', 'Page Views'],
      actions: ['Monitor', 'Analyze Sources', 'Check Rankings']
    },
    {
      id: 4,
      title: 'Conversion Rate Decline',
      description: 'Contact form submissions dropped by 25% this week',
      type: 'warning',
      severity: 'medium',
      status: 'active',
      timestamp: '2025-08-27 16:20',
      category: 'Conversions',
      affectedMetrics: ['Form Submissions', 'Conversion Rate'],
      actions: ['Test Form', 'Check Analytics', 'Review UX']
    },
    {
      id: 5,
      title: 'Mobile Performance Alert',
      description: 'Mobile users experiencing 30% slower load times',
      type: 'performance',
      severity: 'high',
      status: 'resolved',
      timestamp: '2025-08-26 11:30',
      category: 'Performance',
      affectedMetrics: ['Mobile Load Time', 'User Experience'],
      actions: ['Optimize Mobile', 'Test Responsiveness', 'Update CSS']
    }
  ]

  const alertTypes = [
    { value: 'all', label: 'All Alerts', count: alerts.length },
    { value: 'active', label: 'Active', count: alerts.filter(a => a.status === 'active').length },
    { value: 'resolved', label: 'Resolved', count: alerts.filter(a => a.status === 'resolved').length },
    { value: 'performance', label: 'Performance', count: alerts.filter(a => a.type === 'performance').length },
    { value: 'error', label: 'Errors', count: alerts.filter(a => a.type === 'error').length },
    { value: 'warning', label: 'Warnings', count: alerts.filter(a => a.type === 'warning').length }
  ]

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'performance': return <AlertTriangle className="h-4 w-4" />
      case 'error': return <X className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'info': return <Info className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'performance': return 'text-orange-600'
      case 'error': return 'text-red-600'
      case 'warning': return 'text-yellow-600'
      case 'info': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTab = activeTab === 'all' || alert.type === activeTab || 
                      (activeTab === 'active' && alert.status === 'active') ||
                      (activeTab === 'resolved' && alert.status === 'resolved')
    
    return matchesSearch && matchesTab
  })

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 flex items-center justify-center">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
        </div>
        <p className="text-gray-600">Monitor and manage performance alerts and notifications</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Alert
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          <Settings className="h-4 w-4" />
          Alert Settings
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Alert Type Tabs */}
        <div className="flex gap-2 flex-wrap">
          {alertTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setActiveTab(type.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === type.value
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {type.label} ({type.count})
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.map((alert) => (
          <div key={alert.id} className="bg-white rounded-2xl border shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getTypeColor(alert.type)}`}>
                  {getTypeIcon(alert.type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{alert.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {alert.status === 'resolved' && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-100">
                        RESOLVED
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-3">{alert.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      {alert.category}
                    </span>
                    <span>{alert.timestamp}</span>
                  </div>
                  
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Affected Metrics:</span>
                    <div className="flex gap-2 mt-1">
                      {alert.affectedMetrics.map((metric, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {metric}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700">Recommended Actions:</span>
                    <div className="flex gap-2 mt-1">
                      {alert.actions.map((action, index) => (
                        <button
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {alert.status === 'active' && (
                  <button className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200 transition-colors">
                    Mark Resolved
                  </button>
                )}
                <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {filteredAlerts.length === 0 && (
          <div className="bg-white rounded-2xl border shadow-sm p-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-lg mb-2">No alerts found</p>
            <p className="text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Alert</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter alert name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe what triggers this alert"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Performance</option>
                  <option>Error</option>
                  <option>Warning</option>
                  <option>Info</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Threshold</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., > 3s load time"
                />
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
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
