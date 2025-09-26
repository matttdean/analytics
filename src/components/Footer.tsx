export default function Footer() {
  return (
    <footer className="border-t bg-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-sm text-gray-600">
          © 2025 Analytics Dashboard
        </div>
        <div className="flex items-center gap-4">
          <a 
            href="https://deandesign.co" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-2"
          >
            <span>Powered by</span>
            <span className="font-semibold">Dean Design</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  )
}
