'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_PASSWORD = 'praniraksha2024'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const [users, setUsers] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('users')

  function handleLogin() {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      loadData()
    } else {
      setWrongPassword(true)
    }
  }

  async function loadData() {
    setLoading(true)
    var { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    var { data: incidentsData } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })

    setUsers(usersData || [])
    setIncidents(incidentsData || [])
    setLoading(false)
  }

  async function verifyUser(id) {
    var { error } = await supabase.from('users').update({ is_verified: true }).eq('id', id)
    if (error) {
      alert('Verify failed: ' + error.message)
      return
    }
    loadData()
  }

  async function deleteUser(id) {
    await supabase.from('users').delete().eq('id', id)
    loadData()
  }

  async function updateIncidentStatus(id, status) {
    await supabase.from('incidents').update({ status: status }).eq('id', id)
    loadData()
  }

  async function deleteIncident(id) {
    await supabase.from('incidents').delete().eq('id', id)
    loadData()
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '40px', maxWidth: '360px', width: '100%' }}>
          <h1 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Admin Access</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>Prani Raksha Operations Dashboard</p>
          {wrongPassword && (
            <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              Wrong password
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={function(e) { setPassword(e.target.value) }}
            onKeyDown={function(e) { if (e.key === 'Enter') handleLogin() }}
            placeholder="Enter admin password"
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }}
          />
          <button
            onClick={handleLogin}
            style={{ width: '100%', background: '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Login
          </button>
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <a href="/" style={{ color: '#94a3b8', fontSize: '13px' }}>Back to Home</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Arial, sans-serif' }}>

      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>Prani Raksha Admin</span>
          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '12px' }}>Operations Dashboard</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/map" style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none' }}>Live Map</a>
          <button
            onClick={function() { setAuthed(false) }}
            style={{ background: '#334155', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ padding: '20px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#ef4444', fontSize: '28px', fontWeight: 'bold' }}>{incidents.length}</div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Total Incidents</div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#22c55e', fontSize: '28px', fontWeight: 'bold' }}>{users.filter(function(u) { return u.is_verified }).length}</div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Verified Responders</div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#eab308', fontSize: '28px', fontWeight: 'bold' }}>{users.filter(function(u) { return !u.is_verified }).length}</div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Pending Verification</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={function() { setActiveTab('users') }}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', background: activeTab === 'users' ? '#ef4444' : '#1e293b', color: 'white' }}
          >
            Network Members ({users.length})
          </button>
          <button
            onClick={function() { setActiveTab('incidents') }}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', background: activeTab === 'incidents' ? '#ef4444' : '#1e293b', color: 'white' }}
          >
            Incidents ({incidents.length})
          </button>
          <button
            onClick={loadData}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', background: '#334155', color: 'white', marginLeft: 'auto' }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {activeTab === 'users' && (
          <div>
            {users.length === 0 && (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No registered users yet.</div>
            )}
            {users.map(function(user) {
              return (
                <div key={user.id} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>{user.full_name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                      {user.user_role.toUpperCase()} — {user.phone_number}
                    </div>
                    {user.email && (
                      <div style={{ color: '#64748b', fontSize: '11px' }}>{user.email}</div>
                    )}
                    {user.govt_id_type && user.govt_id_number && (
                      <div style={{ color: '#64748b', fontSize: '11px' }}>{user.govt_id_type}: {user.govt_id_number}</div>
                    )}
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ background: user.is_verified ? '#166534' : '#7f1d1d', color: user.is_verified ? '#86efac' : '#fca5a5', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                        {user.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!user.is_verified && (
                      <button
                        onClick={function() { verifyUser(user.id) }}
                        style={{ background: '#166534', color: '#86efac', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={function() { deleteUser(user.id) }}
                      style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'incidents' && (
          <div>
            {incidents.length === 0 && (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No incidents reported yet.</div>
            )}
            {incidents.map(function(incident) {
              var statusColor = {
                reported: '#eab308',
                funds_locked: '#3b82f6',
                ambulance_en_route: '#8b5cf6',
                on_site: '#f97316',
                hospitalized: '#06b6d4',
                resolved: '#22c55e',
                failed: '#ef4444',
              }
              return (
                <div key={incident.id} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                        {incident.animal_species} — {incident.incident_type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                        Severity: {incident.severity || 'Not set'}
                      </div>
                      {incident.description && (
                        <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', maxWidth: '400px' }}>
                          {incident.description}
                        </div>
                      )}
                      <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>
                        {new Date(incident.created_at).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <span style={{ background: (statusColor[incident.status] || '#334155') + '30', color: statusColor[incident.status] || '#94a3b8', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                        {incident.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <select
                        value={incident.status}
                        onChange={function(e) { updateIncidentStatus(incident.id, e.target.value) }}
                        style={{ background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <option value="reported">Reported</option>
                        <option value="funds_locked">Funds Locked</option>
                        <option value="ambulance_en_route">Ambulance En Route</option>
                        <option value="on_site">On Site</option>
                        <option value="hospitalized">Hospitalized</option>
                        <option value="resolved">Resolved</option>
                        <option value="failed">Failed</option>
                      </select>
                      <button
                        onClick={function() { deleteIncident(incident.id) }}
                        style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}