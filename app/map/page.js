'use client'

import dynamic from 'next/dynamic'

const MapDashboard = dynamic(() => import('./MapDashboard'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111827', color: 'white' }}>
      <p>Loading Kolkata Map...</p>
    </div>
  ),
})

export default function MapPage() {
  return <MapDashboard />
}