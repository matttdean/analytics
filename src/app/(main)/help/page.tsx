'use client'

import { useState } from 'react'
import { HelpCircle, Search, BookOpen, MessageCircle, Mail, Phone, FileText, Video, Download, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([])
  const [activeCategory, setActiveCategory] = useState('getting-started')

  // Mock FAQ data
  const faqs = [
    {
      id: 1,
      question: 'How do I connect my Google Analytics account?',
      answer: 'To connect your Google Analytics account, go to Settings > Integrations and click "Connect" next to Google Analytics. You\'ll be redirected to Google to authorize access. Make sure you have admin access to the GA4 property you want to connect.',
      category: 'getting-started'
    },
    {
      id: 2,
      question: 'Why isn\'t my Search Console data showing up?',
      answer: 'If your Search Console data isn\'t appearing, check that: 1) You\'ve connected your Google account, 2) The domain is verified in Search Console, 3) You have the necessary permissions. You may need to wait up to 24 hours for data to sync initially.',
      category: 'search-console'
    },
    {
      id: 3,
      question: 'How often is data refreshed?',
      answer: 'Data refresh rates vary by source: Google Analytics data refreshes every 4 hours, Search Console data updates daily, and Business Profile data syncs every 6 hours. Real-time data is available for active users and current sessions.',
      category: 'data'
    },
    {
      id: 4,
      question: 'Can I export my reports?',
      answer: 'Yes! You can export reports in multiple formats including PDF, CSV, and Excel. Go to the Reports page, select your report, and use the export button. You can also schedule automatic exports to be sent to your email.',
      category: 'reports'
    },
    {
      id: 5,
      question: 'How do I set up performance alerts?',
      answer: 'Navigate to Alerts > Create Alert to set up custom performance monitoring. You can configure thresholds for metrics like load time, conversion rate, or traffic drops. Alerts can be sent via email, push notification, or Slack.',
      category: 'alerts'
    },
    {
      id: 6,
      question: 'What browsers are supported?',
      answer: 'We support all modern browsers including Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+. For the best experience, we recommend using the latest version of Chrome or Firefox.',
      category: 'technical'
    }
  ]

  // Mock documentation categories
  const docCategories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: BookOpen,
      color: 'from-blue-500 to-indigo-500',
      articles: [
        'Quick Start Guide',
        'Account Setup',
        'First Dashboard',
        'Connecting Services'
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: FileText,
      color: 'from-green-500 to-emerald-500',
      articles: [
        'Understanding Metrics',
        'Custom Reports',
        'Data Export',
        'Real-time Monitoring'
      ]
    },
    {
      id: 'search-console',
      title: 'Search Console',
      icon: Search,
      color: 'from-purple-500 to-violet-500',
      articles: [
        'SEO Performance',
        'Keyword Tracking',
        'Click-through Rates',
        'Search Analytics'
      ]
    },
    {
      id: 'business-profile',
      title: 'Business Profile',
      icon: FileText,
      color: 'from-orange-500 to-amber-500',
      articles: [
        'Profile Management',
        'Review Monitoring',
        'Local SEO',
        'Business Insights'
      ]
    }
  ]

  const toggleFaq = (id: number) => {
    setExpandedFaqs(prev => 
      prev.includes(id) 
        ? prev.filter(faqId => faqId !== id)
        : [...prev, id]
    )
  }

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
            <HelpCircle className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
        </div>
        <p className="text-gray-600">Find answers, documentation, and get support</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for help articles, FAQs, or topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">Live Chat</div>
            <div className="text-sm text-gray-600">Get instant help</div>
          </div>
        </button>
        
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Mail className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">Email Support</div>
            <div className="text-sm text-gray-600">Send us a message</div>
          </div>
        </button>
        
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Phone className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">Phone Support</div>
            <div className="text-sm text-gray-600">Call us directly</div>
          </div>
        </button>
      </div>

      {/* Documentation Categories */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Documentation</h2>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {docCategories.map((category) => (
            <div key={category.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className={`h-12 w-12 rounded-lg bg-gradient-to-r ${category.color} flex items-center justify-center mb-3`}>
                <category.icon className="h-6 w-6 text-white" />
              </div>
              
              <h3 className="font-medium text-gray-900 mb-2">{category.title}</h3>
              
              <ul className="space-y-1 text-sm text-gray-600">
                {category.articles.map((article, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    {article}
                  </li>
                ))}
              </ul>
              
              <button className="w-full mt-3 px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors">
                View All
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Video Tutorials */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Video className="h-5 w-5 text-red-600" />
          Video Tutorials
        </h2>
        
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="bg-gray-100 rounded-lg h-32 mb-3 flex items-center justify-center">
              <Video className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Getting Started</h4>
            <p className="text-sm text-gray-600 mb-3">Learn the basics in 5 minutes</p>
            <button className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors">
              Watch Now
            </button>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="bg-gray-100 rounded-lg h-32 mb-3 flex items-center justify-center">
              <Video className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Advanced Analytics</h4>
            <p className="text-sm text-gray-600 mb-3">Deep dive into custom reports</p>
            <button className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors">
              Watch Now
            </button>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="bg-gray-100 rounded-lg h-32 mb-3 flex items-center justify-center">
              <Video className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">SEO Optimization</h4>
            <p className="text-sm text-gray-600 mb-3">Maximize your search performance</p>
            <button className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition-colors">
              Watch Now
            </button>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        
        <div className="space-y-3">
          {filteredFaqs.map((faq) => (
            <div key={faq.id} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleFaq(faq.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                {expandedFaqs.includes(faq.id) ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>
              
              {expandedFaqs.includes(faq.id) && (
                <div className="px-4 pb-4">
                  <p className="text-gray-600">{faq.answer}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors">
                      Was this helpful?
                    </button>
                    <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors">
                      Contact Support
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Still Need Help?</h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Contact Our Support Team</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <span className="text-gray-700">support@deandesign.co</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-green-600" />
                <span className="text-gray-700">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-purple-600" />
                <span className="text-gray-700">Live chat available 9AM-6PM EST</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Support Resources</h3>
            <div className="space-y-3">
              <button className="flex items-center gap-3 w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="h-5 w-5 text-blue-600" />
                <span className="text-gray-700">Download User Manual</span>
              </button>
              <button className="flex items-center gap-3 w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <ExternalLink className="h-5 w-5 text-green-600" />
                <span className="text-gray-700">Visit Knowledge Base</span>
              </button>
              <button className="flex items-center gap-3 w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <MessageCircle className="h-5 w-5 text-purple-600" />
                <span className="text-gray-700">Join Community Forum</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
