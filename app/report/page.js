'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

// Generates a UUID v4 for idempotency — no library needed
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Save failed submission to IndexedDB for offline retry
function saveToOfflineQueue(payload) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prani_raksha_queue', 1)
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pending_incidents', {
        keyPath: 'idempotency_key',
      })
    }
    request.onsuccess = (e) => {
      const db = e.target.result
      const tx = db.transaction('pending_incidents', 'readwrite')
      tx.objectStore('pending_incidents').put(payload)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  })
}

const TRANSLATIONS = {
  en: {
    title: 'Report Street Animal Emergency',
    subtitle: 'No login needed. Report in 3 steps.',
    step1: 'Step 1: Your Location',
    step2: 'Step 2: Animal Type',
    step3: 'Step 3: How Serious?',
    locating: 'Getting your location...',
    locationFound: 'Location found',
    locationError: 'Could not get location. Please enable GPS.',
    retryLocation: 'Retry Location',
    dragToCorrect: 'Location pinned. Drag map to correct if needed.',
    dog: '🐕 Dog',
    cat: '🐈 Cat',
    cow: '🐄 Cow',
    bird: '🐦 Bird',
    other: '🐾 Other',
    low: '🟢 Minor',
    lowDesc: 'Limping, small wound',
    medium: '🟡 Injured',
    mediumDesc: 'Cannot walk, bleeding',
    critical: '🔴 Critical',
    criticalDesc: 'Unconscious, severe trauma',
    optionalPhoto: 'Add Photo (optional)',
    photoHint: 'One photo only. Will be compressed automatically.',
    description: 'Describe what you see (optional)',
    descPlaceholder: 'E.g. Black dog near the tea stall, hit by auto...',
    submit: 'Submit Emergency Report',
    submitting: 'Submitting...',
    successTitle: 'Report Submitted',
    successMsg: 'Your case ID is:',
    successHint: 'Screenshot this ID to track your report.',
    newReport: 'Report Another',
    offlineMsg: 'No internet. Report saved and will auto-submit when online.',
    errorMsg: 'Submission failed. Please try again.',
    langToggle: 'বাংলায় দেখুন',
  },
  bn: {
    title: 'রাস্তার প্রাণীর জরুরি রিপোর্ট',
    subtitle: 'লগইন লাগবে না। ৩টি ধাপে রিপোর্ট করুন।',
    step1: 'ধাপ ১: আপনার অবস্থান',
    step2: 'ধাপ ২: প্রাণীর ধরন',
    step3: 'ধাপ ৩: কতটা গুরুতর?',
    locating: 'অবস্থান খোঁজা হচ্ছে...',
    locationFound: 'অবস্থান পাওয়া গেছে',
    locationError: 'অবস্থান পাওয়া যায়নি। GPS চালু করুন।',
    retryLocation: 'আবার চেষ্টা করুন',
    dragToCorrect: 'অবস্থান চিহ্নিত হয়েছে।',
    dog: '🐕 কুকুর',
    cat: '🐈 বিড়াল',
    cow: '🐄 গরু',
    bird: '🐦 পাখি',
    other: '🐾 অন্যান্য',
    low: '🟢 সামান্য',
    lowDesc: 'খুঁড়িয়ে হাঁটছে, ছোট ক্ষত',
    medium: '🟡 আহত',
    mediumDesc: 'হাঁটতে পারছে না, রক্ত পড়ছে',
    critical: '🔴 গুরুতর',
    criticalDesc: 'অজ্ঞান, মারাত্মক আঘাত',
    optionalPhoto: 'ছবি যোগ করুন (ঐচ্ছিক)',
    photoHint: 'শুধুমাত্র একটি ছবি। স্বয়ংক্রিয়ভাবে সংকুচিত হবে।',
    description: 'আপনি কী দেখছেন লিখুন (ঐচ্ছিক)',
    descPlaceholder: 'যেমন: চায়ের দোকানের পাশে কালো কুকুর, অটোয় চাপা পড়েছে...',
    submit: 'জরুরি রিপোর্ট পাঠান',
    submitting: 'পাঠানো হচ্ছে...',
    successTitle: 'রিপোর্ট জমা হয়েছে',
    successMsg: 'আপনার কেস আইডি:',
    successHint: 'এই আইডিটি স্ক্রিনশট নিন।',
    newReport: 'আরেকটি রিপোর্ট করুন',
    offlineMsg: 'ইন্টারনেট নেই। রিপোর্ট সেভ হয়েছে, অনলাইন হলে পাঠানো হবে।',
    errorMsg: 'জমা দেওয়া ব্যর্থ হয়েছে। আবার চেষ্টা করুন।',
    langToggle: 'View in English',
  },
}

const SPECIES = ['Dog', 'Cat', 'Cow', 'Bird', 'Other']
const SEVERITY = [
  { value: 'low', labelKey: 'low', descKey: 'lowDesc', color: 'bg-green-600 hover:bg-green-500', border: 'border-green-400' },
  { value: 'medium', labelKey: 'medium', descKey: 'mediumDesc', color: 'bg-yellow-500 hover:bg-yellow-400', border: 'border-yellow-300' },
  { value: 'critical_survival', labelKey: 'critical', descKey: 'criticalDesc', color: 'bg-red-600 hover:bg-red-500', border: 'border-red-400' },
]

export default function ReportPage() {
  const [lang, setLang] = useState('en')
  const t = TRANSLATIONS[lang]

  // Form state
  const [location, setLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle') // idle | locating | found | error
  const [species, setSpecies] = useState(null)
  const [severity, setSeverity] = useState(null)
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Submission state
  const [submitStatus, setSubmitStatus] = useState('idle') // idle | submitting | success | offline | error
  const [caseId, setCaseId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const markerRef = useRef(null)

  // Get geolocation on mount
  useEffect(() => {
    getLocation()
  }, [])

  // Initialize Leaflet map once location is found
  useEffect(() => {
    if (location && mapRef.current && !leafletMapRef.current) {
      // Leaflet must be imported dynamically — it uses window object
      import('leaflet').then((L) => {
        // Fix default marker icon paths broken by webpack
        delete L.Icon.Default.prototype._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        const map = L.map(mapRef.current, {
          center: [location.lat, location.lng],
          zoom: 16,
          zoomControl: true,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        const marker = L.marker([location.lat, location.lng], {
          draggable: true,
        }).addTo(map)

        // Update location when marker is dragged
        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng()
          setLocation({ lat: pos.lat, lng: pos.lng })
        })

        leafletMapRef.current = map
        markerRef.current = marker
      })
    }
  }, [location])

  function getLocation() {
    setLocationStatus('locating')
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('found')
      },
      () => {
        setLocationStatus('error')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Compress image client-side to under 500KB before upload
  function compressImage(file) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1024
        let { width, height } = img
        if (width > height && width > MAX) {
          height = (height * MAX) / width
          width = MAX
        } else if (height > MAX) {
          width = (width * MAX) / height
          height = MAX
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.75 // quality
        )
      }
      img.src = url
    })
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPhotoFile(compressed)
    setPhotoPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit() {
    if (!location || !species || !severity) return

    setSubmitStatus('submitting')
    setErrorMsg('')

    const idempotencyKey = generateUUID()
    const incidentId = generateUUID()

    let mediaUrl = null

    // Upload photo if provided
    if (photoFile) {
      const filePath = `incidents/${incidentId}/${photoFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('incident-media')
        .upload(filePath, photoFile, { upsert: false })
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('incident-media')
          .getPublicUrl(filePath)
        mediaUrl = urlData.publicUrl
      }
    }

    const payload = {
      id: incidentId,
      incident_type: 'accident_medical',
      animal_species: species,
      severity: severity,
      description: description.trim() || null,
      raw_media_url: mediaUrl,
      geo_point: `POINT(${location.lng} ${location.lat})`,
      status: 'reported',
      idempotency_key: idempotencyKey,
    }

    // Check if offline
    if (!navigator.onLine) {
      try {
        await saveToOfflineQueue({ ...payload, queued_at: new Date().toISOString() })
        setSubmitStatus('offline')
      } catch {
        setSubmitStatus('error')
        setErrorMsg(t.errorMsg)
      }
      return
    }

    // Submit to Supabase
    const { data, error } = await supabase
      .from('incidents')
      .insert([payload])
      .select('id')
      .single()

    if (error) {
      // If it's a duplicate (idempotency violation), treat as success
      if (error.code === '23505') {
        setCaseId(incidentId)
        setSubmitStatus('success')
        return
      }
      console.error('Submission error:', error)
      // Save offline as fallback
      try {
        await saveToOfflineQueue({ ...payload, queued_at: new Date().toISOString() })
        setSubmitStatus('offline')
      } catch {
        setSubmitStatus('error')
        setErrorMsg(t.errorMsg)
      }
      return
    }

    setCaseId(data.id)
    setSubmitStatus('success')
  }

  function resetForm() {
    setSpecies(null)
    setSeverity(null)
    setDescription('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setSubmitStatus('idle')
    setCaseId(null)
    setErrorMsg('')
    // Re-get location for fresh report
    if (leafletMapRef.current) {
      leafletMapRef.current.remove()
      leafletMapRef.current = null
      markerRef.current = null
    }
    setLocation(null)
    setLocationStatus('idle')
    getLocation()
  }

  const canSubmit = location && species && severity && submitStatus !== 'submitting'

  // ── SUCCESS SCREEN ──────────────────────────────────────────────
  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-center border border-green-700">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-400 mb-2">{t.successTitle}</h2>
          <p className="text-gray-300 mb-3">{t.successMsg}</p>
          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <p className="text-yellow-300 font-mono text-sm break-all">{caseId}</p>
          </div>
          <p className="text-gray-400 text-sm mb-6">{t.successHint}</p>
          <button
            onClick={resetForm}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t.newReport}
          </button>
        </div>
      </div>
    )
  }

  // ── OFFLINE SCREEN ───────────────────────────────────────────────
  if (submitStatus === 'offline') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-center border border-yellow-700">
          <div className="text-6xl mb-4">📴</div>
          <p className="text-yellow-300 font-semibold mb-6">{t.offlineMsg}</p>
          <button
            onClick={resetForm}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t.newReport}
          </button>
        </div>
      </div>
    )
  }

  // ── MAIN FORM ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">{t.title}</h1>
          <p className="text-gray-400 text-xs mt-0.5">{t.subtitle}</p>
        </div>
        <button
          onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-gray-200 shrink-0 ml-3"
        >
          {t.langToggle}
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* STEP 1: LOCATION */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            {t.step1}
          </h2>

          {locationStatus === 'locating' && (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-300 text-sm">{t.locating}</span>
            </div>
          )}

          {locationStatus === 'error' && (
            <div className="space-y-3">
              <p className="text-red-400 text-sm">{t.locationError}</p>
              <button
                onClick={getLocation}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg"
              >
                {t.retryLocation}
              </button>
            </div>
          )}

          {locationStatus === 'found' && (
            <div className="space-y-2">
              <p className="text-green-400 text-sm">✓ {t.locationFound}</p>
              <p className="text-xs text-gray-500">{t.dragToCorrect}</p>
              {/* Leaflet map container */}
              <div
                ref={mapRef}
                className="w-full rounded-xl overflow-hidden border border-gray-700"
                style={{ height: '200px' }}
              />
              <p className="text-xs text-gray-500 font-mono">
                {location?.lat?.toFixed(5)}, {location?.lng?.toFixed(5)}
              </p>
            </div>
          )}
        </div>

        {/* STEP 2: SPECIES */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            {t.step2}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {SPECIES.map((s) => (
              <button
                key={s}
                onClick={() => setSpecies(s)}
                className={`py-4 rounded-xl text-center font-semibold text-sm transition-all border-2 ${
                  species === s
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                }`}
              >
                {t[s.toLowerCase()] || s}
              </button>
            ))}
          </div>
        </div>

        {/* STEP 3: SEVERITY */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            {t.step3}
          </h2>
          <div className="space-y-2">
            {SEVERITY.map((s) => (
              <button
                key={s.value}
                onClick={() => setSeverity(s.value)}
                className={`w-full py-4 px-4 rounded-xl text-left font-semibold transition-all border-2 ${
                  severity === s.value
                    ? `${s.color} ${s.border} text-white`
                    : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <span className="block text-base">{t[s.labelKey]}</span>
                <span className="block text-xs font-normal opacity-80 mt-0.5">
                  {t[s.descKey]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* OPTIONAL: PHOTO */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-1">
            {t.optionalPhoto}
          </h2>
          <p className="text-xs text-gray-500 mb-3">{t.photoHint}</p>
          <label className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
              photoPreview ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'
            }`}>
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="preview"
                  className="max-h-40 mx-auto rounded-lg object-contain"
                />
              ) : (
                <span className="text-gray-400 text-sm">📷 Tap to add photo</span>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
        </div>

        {/* OPTIONAL: DESCRIPTION */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            {t.description}
          </h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.descPlaceholder}
            rows={3}
            maxLength={500}
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl p-3 text-sm resize-none border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <p className="text-right text-xs text-gray-600 mt-1">{description.length}/500</p>
        </div>

        {/* ERROR MESSAGE */}
        {submitStatus === 'error' && (
          <div className="bg-red-900 border border-red-700 rounded-xl p-3">
            <p className="text-red-300 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-5 rounded-2xl font-bold text-lg transition-all ${
            canSubmit
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          {submitStatus === 'submitting' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t.submitting}
            </span>
          ) : (
            t.submit
          )}
        </button>

        <div className="h-6" />
      </div>
    </div>
  )
}