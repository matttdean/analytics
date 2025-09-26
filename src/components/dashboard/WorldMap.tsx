'use client'

import { useState, useMemo } from 'react'
import { Globe, MapPin } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { scaleLinear } from 'd3-scale'

interface CountryData {
  country: string
  users: number
  percentage: number
}

interface WorldMapProps {
  topCountries: CountryData[]
  className?: string
}

// World map topology data (simplified for performance)
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

export default function WorldMap({ topCountries, className = '' }: WorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)
  
  // Create a map of country data for quick lookup
  const countryDataMap = useMemo(() => {
    return new Map(topCountries.map(country => [country.country, country]))
  }, [topCountries])
  
  // Get the maximum users value for scaling
  const maxUsers = useMemo(() => {
    return Math.max(...topCountries.map(c => c.users), 1)
  }, [topCountries])
  
  // Create color scale for countries
  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, maxUsers])
      .range(['#dbeafe', '#1e3a8a']) // Light blue to dark blue
  }, [maxUsers])
  
  // Create size scale for markers
  const sizeScale = useMemo(() => {
    return scaleLinear<number>()
      .domain([0, maxUsers])
      .range([2, 8]) // 2px to 8px
  }, [maxUsers])
  
  // Function to get country color
  const getCountryColor = (countryName: string) => {
    const country = countryDataMap.get(countryName)
    if (!country) return '#f1f5f9' // Light gray for countries not in top list
    return colorScale(country.users)
  }
  
  // Function to get country size
  const getCountrySize = (countryName: string) => {
    const country = countryDataMap.get(countryName)
    if (!country) return 2 // Small size for countries not in top list
    return sizeScale(country.users)
  }
  
  // Function to get country opacity
  const getCountryOpacity = (countryName: string) => {
    const country = countryDataMap.get(countryName)
    if (!country) return 0.3 // Low opacity for countries not in top list
    return 0.8 // High opacity for countries with data
  }

  return (
    <div className={`relative ${className}`}>
      {/* World Map Container */}
      <div className="relative bg-gradient-to-br from-blue-50 via-white to-green-50 rounded-xl p-4 border border-gray-200 shadow-sm">
        {/* Map Title */}
        <div className="absolute top-3 left-3 z-10">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold text-gray-800 shadow-sm border border-gray-200">
            <Globe className="h-4 w-4 text-blue-600" />
            Global Traffic Distribution
          </div>
        </div>
        
        {/* World Map */}
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{
            scale: 147,
            center: [0, 0]
          }}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '400px'
          }}
        >
          <ZoomableGroup>
            {/* Background and countries */}
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name
                  const color = getCountryColor(countryName)
                  const opacity = getCountryOpacity(countryName)
                  const isHovered = hoveredCountry === countryName
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={color}
                      stroke="#64748b"
                      strokeWidth={0.2}
                      opacity={opacity}
                      style={{
                        default: { outline: 'none' },
                        hover: { 
                          outline: 'none',
                          fill: color,
                          opacity: 0.9,
                          stroke: '#1e293b',
                          strokeWidth: 0.5
                        },
                        pressed: { outline: 'none' }
                      }}
                      onMouseEnter={() => setHoveredCountry(countryName)}
                      onMouseLeave={() => setHoveredCountry(null)}
                    />
                  )
                })
              }
            </Geographies>
            
            {/* Country markers for top countries */}
            {topCountries.slice(0, 10).map((country) => {
              // Find the country coordinates from the geography data
              // For now, using approximate coordinates for major countries
              const coordinates = getCountryCoordinates(country.country)
              if (!coordinates) return null
              
              const size = getCountrySize(country.country)
              const color = getCountryColor(country.country)
              const isHovered = hoveredCountry === country.country
              
              return (
                <Marker key={country.country} coordinates={coordinates}>
                  {/* Glow effect */}
                  <circle
                    r={size + 2}
                    fill={color}
                    opacity="0.3"
                    className="animate-pulse"
                  />
                  
                  {/* Main marker */}
                  <circle
                    r={size}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="0.5"
                    style={{
                      filter: isHovered ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))' : 'none',
                      transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                      transition: 'all 0.3s ease'
                    }}
                  />
                  
                  {/* Country label */}
                  {isHovered && (
                    <text
                      textAnchor="middle"
                      y={-size - 5}
                      fontSize="10"
                      fill="#1e293b"
                      fontWeight="600"
                      style={{
                        filter: 'drop-shadow(0 1px 2px rgba(255, 255, 255, 0.9))'
                      }}
                    >
                      {country.country}
                    </text>
                  )}
                </Marker>
              )
            })}
          </ZoomableGroup>
        </ComposableMap>
        
        {/* Enhanced Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
            <span className="text-gray-600 font-medium">Low Traffic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-300 border border-blue-400"></div>
            <span className="text-gray-600 font-medium">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500 border border-blue-600"></div>
            <span className="text-gray-600 font-medium">High Traffic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-700 border border-blue-800"></div>
            <span className="text-gray-600 font-medium">Very High</span>
          </div>
        </div>
      </div>
      
      {/* Top Countries Summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {topCountries.slice(0, 6).map((country, index) => (
          <div 
            key={country.country} 
            className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 hover:border-blue-200 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">{country.country}</div>
              <div className="text-xs text-gray-500">{country.users.toLocaleString()} users</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper function to get approximate coordinates for major countries
function getCountryCoordinates(countryName: string): [number, number] | null {
  const coordinates: Record<string, [number, number]> = {
    'United States': [-95, 38],
    'Canada': [-96, 56],
    'Mexico': [-102, 23],
    'Brazil': [-52, -10],
    'Argentina': [-64, -34],
    'United Kingdom': [-0.1, 54],
    'Germany': [10, 51],
    'France': [2, 46],
    'Italy': [12, 42],
    'Spain': [-3, 40],
    'Russia': [105, 65],
    'China': [105, 35],
    'India': [78, 20],
    'Japan': [138, 36],
    'Australia': [133, -25],
    'South Africa': [24, -29],
    'Egypt': [30, 27],
    'Nigeria': [8, 10],
    'Saudi Arabia': [45, 24],
    'Turkey': [35, 39]
  }
  
  return coordinates[countryName] || null
}
