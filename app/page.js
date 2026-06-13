'use client'

import { useState } from 'react'

export default function HomePage() {
  const [lang, setLang] = useState('en')

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
        <div>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>Prani Raksha</div>
          <div style={{ color: '#64748b', fontSize: '11px' }}>Kolkata Street Animal Welfare</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a href="/map" style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none' }}>Live Map</a>
          <button
            onClick={function() { setLang(function(l) { return l === 'en' ? 'bn' : 'en' }) }}
            style={{ background: '#1e293b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            {lang === 'en' ? 'BN' : 'EN'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
        <h1 style={{ color: 'white', fontSize: '40px', fontWeight: 'bold', margin: '0 0 16px 0', maxWidth: '700px' }}>
          Every Injured Animal Deserves a Response
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '560px', margin: '0 0 48px 0', lineHeight: 1.6 }}>
          A real-time coordination platform connecting street animal feeders, rescuers, transporters, and vet clinics across Kolkata.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '400px', marginBottom: '48px' }}>
          <a href="/report" style={{ display: 'block', background: '#ef4444', color: 'white', padding: '18px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', fontSize: '18px' }}>
            Report Street Emergency
            <div style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.85, marginTop: '4px' }}>
              Injured animal, accident, cruelty
            </div>
          </a>

          <a href="/join" style={{ display: 'block', background: '#1e293b', color: 'white', padding: '18px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', fontSize: '18px', border: '2px solid #334155' }}>
            Join the Network
            <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#94a3b8', marginTop: '4px' }}>
              Feeder, rescuer, transporter, vet clinic
            </div>
          </a>

          <a href="/map" style={{ display: 'block', background: 'transparent', color: '#94a3b8', padding: '14px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', fontSize: '15px', border: '1px solid #1e293b' }}>
            View Live Operations Map
          </a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '500px', width: '100%' }}>
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: 'bold' }}>7</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Map Layers</div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: 'bold' }}>24/7</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Live Tracking</div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: 'bold' }}>0</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Cost to Report</div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#334155', fontSize: '12px', margin: 0 }}>
          Prani Raksha — Built for Kolkata street animals. Free forever.
        </p>
      </div>
    </div>
  )
}