'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchAllMapLayers } from '@/lib/mapLayers'

const LAYER_CONFIG = [
  { key: 'incidents', label: 'Incident Blackspots', labelBn: 'দুর্ঘটনা এলাকা', emoji: '[!]', color: '#ef4444', description: 'Active accidents and cruelty reports' },
  { key: 'packDensity', label: 'Pack Density / Hunger Zones', labelBn: 'প্যাক ঘনত্ব', emoji: '[D]', color: '#f97316', description: 'Street animal population clusters' },
  { key: 'responseCapacity', label: 'Response Capacity', labelBn: 'উদ্ধারকারী নেটওয়ার্ক', emoji: '[+]', color: '#22c55e', description: 'Active rescuers, transporters, vet clinics' },
  { key: 'bioAlerts', label: 'Bio-Alert Outbreak Zones', labelBn: 'রোগ সংক্রমণ এলাকা', emoji: '[W]', color: '#a855f7', description: 'Parvovirus / Distemper 1.5km fence zones' },
  { key: 'abcTargets', label: 'ABC Campaign Targets', labelBn: 'বন্ধ্যাকরণ লক্ষ্য', emoji: '[S]', color: '#eab308', description: 'Wards ready for sterilization' },
  { key: 'genderRatio', label: 'Gender Ratio Matrix', labelBn: 'লিঙ্গ অনুপাত', emoji: '[G]', color: '#ec4899', description: 'Unsterilized female density' },
  { key: 'feederCoverage', label: 'Feeder Coverage', labelBn: 'খাদ্যদাতা কভারেজ', emoji: '[F]', color: '#06b6d4', description: 'Active feeding zones' },
]

function renderIncidents(L, group, data) {
  data.forEach(function(point) {
    var radius = Math.max(12, Math.min(40, point.incident_count * 8))
    var marker = L.circleMarker([point.lat, point.lng], {
      radius: radius,
      fillColor: point.critical_count > 0 ? '#dc2626' : '#f97316',
      color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.75,
    })
    var gmapsUrl = 'https://www.google.com/maps?q=' + point.lat + ',' + point.lng
    marker.bindPopup(
      '<div style="font-family:sans-serif;min-width:180px">' +
      '<b style="color:#dc2626">Incident Cluster</b><br>' +
      'Total active: <b>' + point.incident_count + '</b><br>' +
      'Critical: <b>' + point.critical_count + '</b><br>' +
      'Species: <b>' + (point.dominant_species || 'Mixed') + '</b><br><br>' +
      '<a href="' + gmapsUrl + '" target="_blank" style="display:block;background:#1d4ed8;color:white;text-align:center;padding:6px 10px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:12px">Open in Google Maps</a>' +
      '</div>'
    )
    group.addLayer(marker)
  })
}

function renderPackDensity(L, group, data) {
  data.forEach(function(point) {
    var radius = Math.max(10, Math.min(45, point.total_dogs * 3))
    var marker = L.circleMarker([point.lat, point.lng], {
      radius: radius,
      fillColor: '#f97316',
      color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.65,
    })
    marker.bindPopup(
      '<div style="font-family:sans-serif;min-width:160px">' +
      '<b style="color:#f97316">Pack Cluster</b><br>' +
      'Total dogs: <b>' + point.total_dogs + '</b><br>' +
      'Unsterilized F: <b>' + point.unsterilized_females + '</b><br>' +
      'Unsterilized M: <b>' + point.unsterilized_males + '</b><br>' +
      'Ear-tipped: <b>' + point.sterilized + '</b></div>'
    )
    group.addLayer(marker)
  })
}

function renderResponseCapacity(L, group, data) {
  var roleColor = { rescuer: '#22c55e', transporter: '#3b82f6', vet_clinic: '#a855f7' }
  data.forEach(function(point) {
    var marker = L.circleMarker([point.lat, point.lng], {
      radius: 10,
      fillColor: roleColor[point.user_role] || '#22c55e',
      color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9,
    })
    marker.bindPopup(
      '<div style="font-family:sans-serif;min-width:140px">' +
      '<b>' + point.user_role.toUpperCase() + '</b><br>' +
      point.full_name + '<br>' +
      '<span style="color:#22c55e;font-size:11px">Verified</span></div>'
    )
    group.addLayer(marker)
  })
}

function renderBioAlerts(L, group, data) {
  var pathogenColor = { parvovirus: '#dc2626', canine_distemper: '#7c3aed', rabies_suspect: '#b45309', severe_mange: '#0891b2' }
  data.forEach(function(point) {
    var color = pathogenColor[point.pathogen] || '#a855f7'
    var fence = L.circle([point.lat, point.lng], {
      radius: point.fence_radius_meters,
      fillColor: color, color: color,
      weight: 2, opacity: 0.8, fillOpacity: 0.15, dashArray: '6, 4',
    })
    var reportedDate = point.reported_at ? new Date(point.reported_at).toLocaleDateString('en-IN') : 'Unknown'
    fence.bindPopup(
      '<div style="font-family:sans-serif;min-width:180px">' +
      '<b style="color:' + color + '">BIO-ALERT</b><br>' +
      'Pathogen: <b>' + point.pathogen.replace('_', ' ').toUpperCase() + '</b><br>' +
      'Ward: <b>' + (point.ward_id || 'Unassigned') + '</b><br>' +
      'Reported: <b>' + reportedDate + '</b><br>' +
      '<span style="font-size:11px;color:#6b7280">Ring-vaccination zone: 1.5km</span></div>'
    )
    group.addLayer(fence)
    var dot = L.circleMarker([point.lat, point.lng], { radius: 6, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 })
    group.addLayer(dot)
  })
}

function renderAbcTargets(L, group, data) {
  var urgencyColor = { URGENT: '#ef4444', OVERDUE: '#b45309', MONITOR: '#eab308' }
  data.forEach(function(point) {
    var color = urgencyColor[point.urgency] || '#eab308'
    var marker = L.circleMarker([point.lat, point.lng], {
      radius: point.urgency === 'URGENT' ? 14 : 10,
      fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.85,
    })
    marker.bindPopup(
      '<div style="font-family:sans-serif;min-width:160px">' +
      '<b style="color:' + color + '">ABC Target - ' + point.urgency + '</b><br>' +
      'Ward: <b>' + (point.ward_id || 'N/A') + '</b><br>' +
      'Litter born: <b>' + point.litter_birth_date + '</b><br>' +
      'Age: <b>' + point.months_since_birth + ' months</b></div>'
    )
    group.addLayer(marker)
  })
}

function renderGenderRatio(L, group, data) {
  var priorityColor = { HIGH: '#ec4899', MEDIUM: '#f472b6', LOW: '#fce7f3' }
  data.forEach(function(point) {
    var color = priorityColor[point.priority_score] || '#ec4899'
    var radius = Math.max(8, Math.min(35, point.total * 2))
    var marker = L.circleMarker([point.lat, point.lng], {
      radius: radius, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.7,
    })
    marker.bindPopup(
      '<div style="font-family:sans-serif;min-width:160px">' +
      '<b style="color:#ec4899">Gender Ratio</b><br>' +
      'Total pack: <b>' + point.total + '</b><br>' +
      'Female ratio: <b>' + point.female_ratio + '%</b><br>' +
      'Priority: <b style="color:' + color + '">' + point.priority_score + '</b></div>'
    )
    group.addLayer(marker)
  })
}

function renderFeederCoverage(L, group, data) {
  data.forEach(function(point) {
    var marker = L.circleMarker([point.lat, point.lng], {
      radius: 9,
      fillColor: point.is_verified ? '#06b6d4' : '#94a3b8',
      color: '#fff', weight: 2, fillOpacity: 0.85,
    })
    marker.bindPopup(
      '<div style="font-family:sans-serif;min-width:140px">' +
      '<b style="color:#06b6d4">Feeder</b><br>' +
      point.feeder_name + '<br>' +
      '<span style="font-size:11px">' + (point.is_verified ? 'Verified' : 'Pending') + '</span></div>'
    )
    group.addLayer(marker)
  })
}

var RENDERERS = {
  incidents: renderIncidents,
  packDensity: renderPackDensity,
  responseCapacity: renderResponseCapacity,
  bioAlerts: renderBioAlerts,
  abcTargets: renderAbcTargets,
  genderRatio: renderGenderRatio,
  feederCoverage: renderFeederCoverage,
}

export default function MapDashboard() {
  var mapRef = useRef(null)
  var mapDivRef = useRef(null)
  var layerGroupsRef = useRef({})
  var leafletRef = useRef(null)

  var [isLoading, setIsLoading] = useState(true)
  var [loadError, setLoadError] = useState(null)
  var [dataStats, setDataStats] = useState({})
  var [visibleLayers, setVisibleLayers] = useState({
    incidents: true,
    packDensity: true,
    responseCapacity: true,
    bioAlerts: true,
    abcTargets: false,
    genderRatio: false,
    feederCoverage: false,
  })
  var [isPanelOpen, setIsPanelOpen] = useState(true)
  var [language, setLanguage] = useState('en')

  useEffect(function() {
    if (mapRef.current) return

    async function initMap() {
      var L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      leafletRef.current = L.default || L
      var Leaflet = leafletRef.current

      var map = Leaflet.map(mapDivRef.current, {
        center: [22.5726, 88.3639],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      })

      Leaflet.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
  attribution: 'OpenStreetMap France',
  maxZoom: 20,
}).addTo(map)

      LAYER_CONFIG.forEach(function(cfg) {
        var group = Leaflet.layerGroup()
        layerGroupsRef.current[cfg.key] = group
        if (visibleLayers[cfg.key]) {
          group.addTo(map)
        }
      })

      mapRef.current = map

      try {
        var data = await fetchAllMapLayers()
        var stats = {}
        LAYER_CONFIG.forEach(function(cfg) {
          stats[cfg.key] = (data[cfg.key] || []).length
          var renderer = RENDERERS[cfg.key]
          var group = layerGroupsRef.current[cfg.key]
          if (renderer && data[cfg.key] && data[cfg.key].length > 0) {
            renderer(Leaflet, group, data[cfg.key])
          }
        })
        setDataStats(stats)
      } catch (err) {
        console.error('Map data load failed:', err)
        setLoadError('Failed to load map data. Check your connection.')
      } finally {
        setIsLoading(false)
      }
    }

    initMap()

    return function() {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  var toggleLayer = useCallback(function(key) {
    if (!mapRef.current) return
    var map = mapRef.current
    var group = layerGroupsRef.current[key]
    if (!group) return
    setVisibleLayers(function(prev) {
      var nowVisible = !prev[key]
      if (nowVisible) { group.addTo(map) } else { map.removeLayer(group) }
      return Object.assign({}, prev, { [key]: nowVisible })
    })
  }, [])

  var refreshData = useCallback(async function() {
    if (!mapRef.current || !leafletRef.current) return
    setIsLoading(true)
    var Lref = leafletRef.current
    try {
      var data = await fetchAllMapLayers()
      var stats = {}
      LAYER_CONFIG.forEach(function(cfg) {
        if (layerGroupsRef.current[cfg.key]) {
          layerGroupsRef.current[cfg.key].clearLayers()
        }
        stats[cfg.key] = (data[cfg.key] || []).length
        var renderer = RENDERERS[cfg.key]
        var group = layerGroupsRef.current[cfg.key]
        if (renderer && data[cfg.key] && data[cfg.key].length > 0) {
          renderer(Lref, group, data[cfg.key])
        }
      })
      setDataStats(stats)
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">

      <div ref={mapDivRef} className="absolute inset-0 z-0" />

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80">
          <div className="text-center text-white">
            <p className="text-xl font-bold mt-4">Loading Field Data...</p>
            <p className="text-sm text-gray-400 mt-1">Querying Kolkata PostGIS database</p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {loadError}
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 z-30 bg-gray-900 bg-opacity-90 border-b border-gray-700 px-3 py-2 flex items-center justify-between">
        <span className="text-white font-bold text-sm">
          {language === 'en' ? 'Prani Raksha - Live Map' : 'প্রাণী রক্ষা - লাইভ ম্যাপ'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={function() { setLanguage(function(l) { return l === 'en' ? 'bn' : 'en' }) }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
          >
            {language === 'en' ? 'BN' : 'EN'}
          </button>
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="text-xs bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-2 py-1 rounded"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <a href="/report" className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded font-semibold">
            Report Emergency
          </a>
        </div>
      </div>

      <div className="absolute z-30 left-0 right-0 bottom-0 md:left-auto md:right-4 md:bottom-auto md:top-16 md:w-72">
        <div className="bg-gray-900 bg-opacity-95 border border-gray-700 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-white font-bold text-sm">
              {language === 'en' ? 'Map Layers' : 'ম্যাপ স্তর'}
            </span>
            <button
              onClick={function() { setIsPanelOpen(function(p) { return !p }) }}
              className="text-gray-400 hover:text-white text-xs bg-gray-800 px-2 py-1 rounded"
            >
              {isPanelOpen ? 'Hide' : 'Show'}
            </button>
          </div>

          {isPanelOpen && (
            <div className="max-h-72 md:max-h-96 overflow-y-auto">
              {LAYER_CONFIG.map(function(cfg) {
                var isVisible = visibleLayers[cfg.key]
                var count = dataStats[cfg.key] !== undefined ? dataStats[cfg.key] : '...'
                return (
                  <button
                    key={cfg.key}
                    onClick={function() { toggleLayer(cfg.key) }}
                    className={'w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-800 last:border-0 ' + (isVisible ? 'bg-gray-800' : 'bg-gray-900 opacity-60')}
                  >
                    <div
                      className="mt-0.5 w-3 h-3 rounded-full flex-shrink-0 border-2"
                      style={{ backgroundColor: isVisible ? cfg.color : 'transparent', borderColor: cfg.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-semibold truncate">
                          {cfg.emoji} {language === 'en' ? cfg.label : cfg.labelBn}
                        </span>
                        <span
                          className="text-xs font-mono ml-2 flex-shrink-0 px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: cfg.color + '30', color: cfg.color }}
                        >
                          {count}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5 truncate">{cfg.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="px-4 py-2 bg-gray-950 text-gray-500 text-xs text-center">
            {language === 'en' ? 'Tap layer to toggle. Tap markers for details.' : 'স্তর চালু/বন্ধ করতে ট্যাপ করুন।'}
          </div>
        </div>
      </div>

    </div>
  )
}