'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const ROLES = [
  { value: 'feeder', label: 'Street Feeder', desc: 'I regularly feed street animals in my area' },
  { value: 'rescuer', label: 'Rescuer / Paravet', desc: 'I can physically rescue and provide first aid' },
  { value: 'transporter', label: 'Transporter / Driver', desc: 'I have a vehicle and can transport animals' },
  { value: 'vet_clinic', label: 'Vet Clinic / Shelter', desc: 'I am a vet clinic or animal shelter' },
]

export default function JoinPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    user_role: '',
    govt_id_type: 'Aadhaar',
    govt_id_number: '',
    lat: null,
    lng: null,
  })

  function updateForm(key, value) {
    setForm(function(prev) { return Object.assign({}, prev, { [key]: value }) })
  }

  function getLocation() {
    setLocationLoading(true)
    setError(null)
    if (!navigator.geolocation) {
      setError('GPS not supported on this device.')
      setLocationLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        updateForm('lat', pos.coords.latitude)
        updateForm('lng', pos.coords.longitude)
        setLocationLoading(false)
      },
      function() {
        setError('Could not get your location. Please allow GPS access.')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    if (!form.full_name || !form.phone_number || !form.user_role) {
      setError('Please fill in your name, phone number, and select your role.')
      setLoading(false)
      return
    }

    var payload = {
      full_name: form.full_name,
      phone_number: form.phone_number,
      email: form.email || null,
      user_role: form.user_role,
      govt_id_type: form.govt_id_type || null,
      govt_id_number: form.govt_id_number || null,
      is_verified: false,
    }

    if (form.lat && form.lng) {
      payload.current_location = 'POINT(' + form.lng + ' ' + form.lat + ')'
    }

    var { error: dbError } = await supabase.from('users').insert(payload)

    if (dbError) {
      if (dbError.code === '23505') {
        setError('This phone number is already registered.')
      } else {
        setError('Registration failed: ' + dbError.message)
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <h2 style={{ color: '#22c55e', fontSize: '22px', fontWeight: 'bold', marginBottom: '12px' }}>
            Registration Successful!
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            Thank you for joining the Prani Raksha network. Our team will verify your details and activate your account shortly.
          </p>
          <a href="/map" style={{ display: 'block', background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
            View Live Map
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>

        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none' }}>
            Back to Home
          </a>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 'bold', margin: '8px 0 0 0' }}>
            Join Prani Raksha
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
            Register as a network responder
          </p>
        </div>

        {error && (
          <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>

          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px', marginTop: 0 }}>
            Select your role:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {ROLES.map(function(role) {
              var selected = form.user_role === role.value
              return (
                <button
                  key={role.value}
                  onClick={function() { updateForm('user_role', role.value) }}
                  style={{
                    background: selected ? '#1d4ed8' : '#0f172a',
                    border: selected ? '2px solid #3b82f6' : '2px solid #334155',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold' }}>
                    {role.label}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                    {role.desc}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Full Name *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={function(e) { updateForm('full_name', e.target.value) }}
              placeholder="Your full name"
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Phone Number * (WhatsApp)</label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={function(e) { updateForm('phone_number', e.target.value) }}
              placeholder="e.g. 9831234567"
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={function(e) { updateForm('email', e.target.value) }}
              placeholder="your@email.com"
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>ID Type</label>
            <select
              value={form.govt_id_type}
              onChange={function(e) { updateForm('govt_id_type', e.target.value) }}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
            >
              <option value="Aadhaar">Aadhaar</option>
              <option value="Veterinary Council ID">Veterinary Council ID</option>
              <option value="Police Badge ID">Police Badge ID</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>ID Number (optional)</label>
            <input
              type="text"
              value={form.govt_id_number}
              onChange={function(e) { updateForm('govt_id_number', e.target.value) }}
              placeholder="Your ID number"
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '20px', background: '#0f172a', borderRadius: '10px', padding: '14px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold' }}>Your Location</div>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                  {form.lat ? 'GPS captured: ' + form.lat.toFixed(4) + ', ' + form.lng.toFixed(4) : 'Tap to capture your area location'}
                </div>
              </div>
              <button
                onClick={getLocation}
                disabled={locationLoading}
                style={{ background: form.lat ? '#166534' : '#1d4ed8', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                {locationLoading ? 'Getting...' : form.lat ? 'Got it' : 'Get GPS'}
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', background: loading ? '#334155' : '#ef4444', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Registering...' : 'Join the Network'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <a href="/map" style={{ color: '#94a3b8', fontSize: '13px' }}>View live map instead</a>
          </div>

        </div>
      </div>
    </div>
  )
}