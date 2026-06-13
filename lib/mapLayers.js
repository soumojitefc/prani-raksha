// lib/mapLayers.js
// All 7 map layer fetch functions.
// Each calls a PostGIS RPC. Returns clean arrays or throws.
// We use Promise.allSettled at the call site so one failure doesn't kill the whole map.

import { supabase } from '@/lib/supabase'

function getClient() {
  return supabase
}

// LAYER 1 — Incident Blackspots
export async function fetchIncidentClusters() {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('get_incident_clusters', { grid_size: 0.01 })
  if (error) throw new Error(`Layer 1 RPC failed: ${error.message}`)
  return data || []
}

// LAYER 2 — Pack Density / Hunger Zones
export async function fetchPackDensity() {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('get_pack_density_clusters', { grid_size: 0.008 })
  if (error) throw new Error(`Layer 2 RPC failed: ${error.message}`)
  return data || []
}

// LAYER 3 — Response Capacity (Rescuers, Transporters, Clinics)
export async function fetchResponseCapacity() {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('get_response_capacity')
  if (error) throw new Error(`Layer 3 RPC failed: ${error.message}`)
  return data || []
}

// LAYER 4 — Bio-Alert Outbreak Zones
export async function fetchBioAlerts() {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('get_active_bio_alerts')
  if (error) throw new Error(`Layer 4 RPC failed: ${error.message}`)
  return data || []
}

// LAYER 5 — ABC Campaign Targets (Puppy Spikes)
export async function fetchAbcTargets() {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('get_abc_campaign_targets')
  if (error) throw new Error(`Layer 5 RPC failed: ${error.message}`)
  return data || []
}

// LAYER 6 — Gender Ratio Matrix
export async function fetchGenderRatioMatrix() {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('get_gender_ratio_matrix', { grid_size: 0.01 })
  if (error) throw new Error(`Layer 6 RPC failed: ${error.message}`)
  return data || []
}

// LAYER 7 — Feeder Coverage (Hunger Cold Zones)
export async function fetchFeederCoverage() {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('get_feeder_coverage')
  if (error) throw new Error(`Layer 7 RPC failed: ${error.message}`)
  return data || []
}

// Master loader — fires all 7 in parallel. Never throws.
// Returns object with layer keys. Failed layers get empty arrays + logged errors.
export async function fetchAllMapLayers() {
  const fetchers = [
    fetchIncidentClusters,
    fetchPackDensity,
    fetchResponseCapacity,
    fetchBioAlerts,
    fetchAbcTargets,
    fetchGenderRatioMatrix,
    fetchFeederCoverage,
  ]

  const keys = [
    'incidents',
    'packDensity',
    'responseCapacity',
    'bioAlerts',
    'abcTargets',
    'genderRatio',
    'feederCoverage',
  ]

  const results = await Promise.allSettled(fetchers.map(fn => fn()))

  const layerData = {}
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      layerData[keys[i]] = result.value
    } else {
      console.error(`[MapLayer ${keys[i]}] ${result.reason}`)
      layerData[keys[i]] = [] // Fail gracefully — empty layer, map still loads
    }
  })

  return layerData
}