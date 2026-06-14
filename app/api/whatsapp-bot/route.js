// app/api/whatsapp-bot/route.js

import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// =============================================================================
// STATIC MESSAGE TEMPLATES
// =============================================================================

const MSG = {
  MENU: `Prani Raksha - Kolkata Street Animal Rescue

What do you need help with?

1 - Report injured or sick animal
2 - Report animal cruelty
3 - Join our rescue network
4 - Contact authorities (police / KMC)

Reply with a number`,

  REPORT_LOCATION: `Step 1 of 4 - Location

Where is the animal right now?

Best option: Tap the clip icon, then Location, then Send Current Location

No GPS? Just type the nearest landmark:
Near Gariahat crossing petrol pump
Opp Magnolia Skyview gate Kalikapur

Anything searchable on Google Maps works.`,

  REPORT_SPECIES: (incidentType) =>
    `${incidentType === 'cruelty' ? 'Cruelty Report' : 'Rescue Report'}

Step 2 of 4 - Animal type

What animal needs help?

1 - Dog
2 - Cat
3 - Cow
4 - Bird
5 - Other`,

  REPORT_SEVERITY: `Step 3 of 4 - Condition

How bad is it?

1 - Critical - cannot move, bleeding, unconscious
2 - Urgent - injured but mobile, visibly suffering
3 - Needs attention - sick, mange, trapped but stable`,

  REPORT_LANDMARK: `Step 4 of 4 - Exact spot

Describe exactly where the animal is.
The rescuer will read this to find them.

Example: Behind the blue gate, near the chai stall, dog is under the parked truck

One line is enough. Type anything that helps.`,

  REPORT_CONSENT: (species) =>
    `Almost done - one quick question.

May we share your WhatsApp number with the rescuer who accepts this rescue?

1 - Yes, share my number (helps the rescuer find the ${species.toLowerCase()} faster)

2 - No, keep me anonymous (we respect your privacy - report still goes through immediately)

Reply 1 or 2`,

  REPORT_SUBMITTED_WITH_COORDS: (species, areaName, sharedNumber) =>
    `Report submitted!

Rescuers near ${areaName} are being alerted now.

${sharedNumber
  ? `Your number will be shared only with the rescuer who accepts.`
  : `You chose to stay anonymous - that is completely fine.`}

You will get a message here when a rescuer accepts the ${species.toLowerCase()} rescue.

Thank you for helping.`,

  REPORT_SUBMITTED_NO_COORDS: (species, sharedNumber) =>
    `Report submitted!

No GPS coordinates - rescuers will navigate using your landmark description.

${sharedNumber
  ? `Your number will be shared with the rescuer so they can call you for directions.`
  : `You chose to stay anonymous. The rescuer will use your landmark description.`}

You will get a message when a rescuer accepts the ${species.toLowerCase()} rescue.

Thank you for helping.`,

  JOIN_ROLE: `Join Prani Raksha Network

What is your role?

1 - Rescuer - I can go to the spot and help
2 - Feeder - I regularly feed street animals
3 - Transporter - I have a vehicle (toto/auto/car)
4 - Vet Clinic or Shelter - I can treat animals`,

  JOIN_NAME: `What is your full name?`,

  JOIN_LOCATION: `Share your area location so we can match you with nearby incidents.

Tap the clip icon, then Location, then Send Current Location

OR type your neighbourhood:
Shyambazar or Behala Chowrasta`,

  JOIN_SUBMITTED: (name, role) =>
    `Registration received!

Welcome, ${name}

Role: ${role}

Our admin will verify your details within 24 hours. Once verified, you will start receiving rescue alerts near your area.

For questions: +919830000011`,

  AUTHORITY: `Reporting to Authorities

KMC Animal Welfare Cell
1800-103-4204 (toll free)

Kolkata Police PCR
100

West Bengal SPCA
033-2249-0946

For cruelty cases: Text FIR and we will guide you through filing a complaint under the Prevention of Cruelty to Animals Act.`,

  ISSUE_RECEIVED: `Your concern has been logged.

Our admin will review this within 24 hours. If you feel unsafe, please call Kolkata Police at 100.

Thank you for letting us know.`,

  UNKNOWN: `I did not understand that.

Text HI to see the main menu.

For emergency rescue: text HELP
To accept a rescue: text 1
Status updates: ONSITE or CLINIC or DONE`,

  HELP_SHORTCUT: `Emergency rescue report

Where is the animal? Share your location or type the nearest landmark now.`,
}

// =============================================================================
// MAPS
// =============================================================================
const SPECIES_MAP = { '1': 'Dog', '2': 'Cat', '3': 'Cow', '4': 'Bird', '5': 'Other' }
const SEVERITY_MAP = { '1': 'critical_survival', '2': 'medium', '3': 'low' }
const ROLE_MAP = { '1': 'rescuer', '2': 'feeder', '3': 'transporter', '4': 'vet_clinic' }
const ROLE_LABEL_MAP = {
  'rescuer': 'Rescuer',
  'feeder': 'Feeder',
  'transporter': 'Transporter',
  'vet_clinic': 'Vet Clinic / Shelter'
}

// =============================================================================
// LOCATION PARSER
// =============================================================================
function parseLocation(formData, bodyText) {
  const lat = formData.get('Latitude')
  const lng = formData.get('Longitude')
  const address = formData.get('Address') || ''
  const label = formData.get('Label') || ''

  if (lat && lng) {
    return {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      typed_address: [label, address].filter(Boolean).join(', ') || null,
      is_pin: true
    }
  }

  if (bodyText && bodyText.length > 2) {
    return {
      lat: null,
      lng: null,
      typed_address: bodyText.trim(),
      is_pin: false
    }
  }

  return null
}

// =============================================================================
// TWIML RESPONSE BUILDER — plain text, no escaping, no CDATA
// =============================================================================
function twiml(message) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
  )
}

// =============================================================================
// SESSION HELPERS
// =============================================================================
async function getSession(phone) {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('state, partial_data, expires_at')
    .eq('phone_number', phone)
    .maybeSingle()

  if (error) {
    console.error('[SESSION GET ERROR]', phone, error.message)
    return { state: 'idle', partial_data: {} }
  }
  if (!data) return { state: 'idle', partial_data: {} }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { state: 'idle', partial_data: {} }
  }
  let parsed = data.partial_data
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { parsed = {} }
  }
  return { state: data.state || 'idle', partial_data: parsed || {} }
}

async function saveSession(phone, state, partialData) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .upsert(
      {
        phone_number: phone,
        state:        state,
        partial_data: partialData,
        updated_at:   new Date().toISOString(),
        expires_at:   new Date(Date.now() + 10 * 60 * 1000).toISOString()
      },
      { onConflict: 'phone_number' }
    )
  if (error) console.error('[SESSION SAVE ERROR]', phone, state, error.message)
}

async function clearSession(phone) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .delete()
    .eq('phone_number', phone)
  if (error) console.error('[SESSION CLEAR ERROR]', phone, error.message)
}

// =============================================================================
// FIRE ALERTS TO NEARBY RESCUERS
// =============================================================================
async function fireRescuerAlerts(incidentId, species, severity, areaName, landmarkText) {
  try {
    const { data: rescuers } = await supabase.rpc('get_nearby_rescuers', {
      p_incident_id: incidentId,
      p_radius_meters: 5000.0
    })

    if (!rescuers || rescuers.length === 0) {
      console.warn(`[bot] No rescuers within 5km for incident ${incidentId}`)
      return
    }

    const unalerted = rescuers.filter(r => !r.already_alerted)
    if (unalerted.length === 0) return

    const severityLabel = severity === 'critical_survival' ? 'CRITICAL'
      : severity === 'medium' ? 'URGENT' : 'LOW'

    const alertMsg = (
      `PRANI RAKSHA ALERT\n` +
      `${severityLabel} | ${species} | ${areaName}\n\n` +
      `Location: ${landmarkText}\n\n` +
      `Reply 1 to ACCEPT this rescue\n` +
      `Reply 2 to skip\n\n` +
      `ID: ${incidentId.substring(0, 8)}`
    )

    await Promise.allSettled(
      unalerted.map(async (rescuer) => {
        const toNumber = rescuer.phone_number.startsWith('+')
          ? `whatsapp:${rescuer.phone_number}`
          : `whatsapp:+91${rescuer.phone_number}`
        try {
          await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_FROM,
            to: toNumber,
            body: alertMsg
          })
          console.log(`[bot] Alert sent to ${rescuer.phone_number}`)
        } catch (e) {
          console.error(`[bot] Twilio failed for ${rescuer.phone_number}:`, e.message)
        }
      })
    )
  } catch (err) {
    console.error('[bot] fireRescuerAlerts error:', err)
  }
}

// =============================================================================
// NOTIFY REPORTER
// =============================================================================
async function notifyReporter(reporterPhone, rescuerName, species) {
  if (!reporterPhone) return
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${reporterPhone}`,
      body: (
        `Update on your report\n\n` +
        `${rescuerName} has accepted the ${species.toLowerCase()} rescue and is on the way.\n\n` +
        `If you are still near the animal, please stay close if it is safe to do so.\n\n` +
        `Thank you for reporting.`
      )
    })
  } catch (e) {
    console.error('[bot] notifyReporter failed:', e.message)
  }
}

// =============================================================================
// HANDLE RESCUE ACCEPTANCE
// =============================================================================
async function handleRescueAccept(phone, session) {
  const normalizedPhone = phone.replace('whatsapp:', '')

  const pendingIncidentId = session.partial_data?.pending_incident_id || null

  if (!pendingIncidentId) {
    return twiml('No open rescue found for your number. It may already have been accepted. Thank you!')
  }

  const { data: acceptResult } = await supabase.rpc('incident_accepted_by_rescuer', {
    p_incident_id: pendingIncidentId,
    p_rescuer_phone: normalizedPhone
  })

  if (!acceptResult || acceptResult.length === 0) {
    return twiml('System error. Please try again or call +919830000011.')
  }

  const result = acceptResult[0]

  if (!result.success) {
    return twiml(`Update: ${result.error_reason}. Thank you for responding!`)
  }

  const { data: incidentRow } = await supabase
    .from('incidents')
    .select('reporter_phone_shared, reporter_whatsapp_number, animal_species, landmark_text')
    .eq('id', pendingIncidentId)
    .single()

  const species = incidentRow?.animal_species || 'Animal'
  const landmark = incidentRow?.landmark_text || 'Use GPS coordinates'

  if (incidentRow?.reporter_whatsapp_number) {
    await notifyReporter(incidentRow.reporter_whatsapp_number, result.rescuer_name, species)
  }

  const phoneSection = (incidentRow?.reporter_phone_shared && incidentRow?.reporter_whatsapp_number)
    ? `\nReporter number: ${incidentRow.reporter_whatsapp_number} (call for exact directions)`
    : `\nReporter is anonymous. Use landmark below.`

  const mapsSection = result.incident_lat
    ? `\nNavigate here:\nhttps://www.google.com/maps/dir/?api=1&destination=${result.incident_lat},${result.incident_lng}`
    : ''

  return twiml(
    `RESCUE CONFIRMED\n\n` +
    `You have been assigned this rescue, ${result.rescuer_name}.\n` +
    `${mapsSection}` +
    `${phoneSection}\n\n` +
    `Exact spot: ${landmark}\n\n` +
    `Status updates - reply:\n` +
    `ONSITE when you arrive\n` +
    `CLINIC when animal is in vehicle\n` +
    `DONE when animal admitted to clinic\n\n` +
    `If you have concerns, text ISSUE`
  )
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
export async function POST(request) {
  const formData = await request.formData()
  const fromRaw  = formData.get('From') || ''
  const bodyRaw  = (formData.get('Body') || '').trim()
  const body     = bodyRaw.toLowerCase()

  // DEBUG — remove after location pin confirmed working
  console.log('[DEBUG FORM]', JSON.stringify(Object.fromEntries(formData.entries())))

  const phone = fromRaw.replace('whatsapp:', '')
  if (!phone) return twiml('Message received.')

  // Hard keywords
  if (['hi', 'hello', 'menu', 'start'].includes(body)) {
    await saveSession(phone, 'menu', {})
    return twiml(MSG.MENU)
  }

  if (body === 'help' || body === 'emergency') {
    await saveSession(phone, 'report:location', { incident_type: 'accident_medical' })
    return twiml(MSG.HELP_SHORTCUT)
  }

  if (body === 'issue') {
    const { data: active } = await supabase.rpc('get_rescuer_active_incident', {
      p_rescuer_phone: phone
    })
    await supabase.from('complaint_log').insert({
      reporter_phone: phone,
      rescuer_id:     active?.[0]?.rescuer_id || null,
      incident_id:    active?.[0]?.incident_id || null,
      complaint_text: 'Rescuer raised concern via ISSUE keyword'
    })
    return twiml(MSG.ISSUE_RECEIVED)
  }

  if (['onsite', 'clinic', 'done'].includes(body)) {
    const { data: active } = await supabase.rpc('get_rescuer_active_incident', {
      p_rescuer_phone: phone
    })
    if (!active || active.length === 0) {
      return twiml('No active rescue assignment found for your number.')
    }
    const { incident_id } = active[0]
    const statusMap = { 'onsite': 'on_site', 'clinic': 'hospitalized', 'done': 'resolved' }
    const replyMap = {
      'onsite': `Status: On Site\n\nGood luck! When the animal is in the vehicle, text CLINIC.`,
      'clinic': `Status: In Transit to Clinic\n\nAlmost there. Text DONE once the animal is admitted.`,
      'done':   `Rescue Complete!\n\nAmazing work. This rescue has been logged and closed.\n\nYou will be alerted for the next emergency near you.\n\nThank you, hero.`
    }
    await supabase
      .from('incidents')
      .update({ status: statusMap[body], updated_at: new Date().toISOString() })
      .eq('id', incident_id)
    return twiml(replyMap[body])
  }

  // Load session
  const session = await getSession(phone)
  const { state, partial_data: data } = session

  if (state === 'idle') {
    await saveSession(phone, 'menu', {})
    return twiml(MSG.MENU)
  }

  if (state === 'menu') {
    if (body === '1') {
      await saveSession(phone, 'report:location', { incident_type: 'accident_medical' })
      return twiml(MSG.REPORT_LOCATION)
    }
    if (body === '2') {
      await saveSession(phone, 'report:location', { incident_type: 'cruelty' })
      return twiml(MSG.REPORT_LOCATION)
    }
    if (body === '3') {
      await saveSession(phone, 'join:role', {})
      return twiml(MSG.JOIN_ROLE)
    }
    if (body === '4') {
      await saveSession(phone, 'idle', {})
      return twiml(MSG.AUTHORITY)
    }
    return twiml(MSG.MENU)
  }

  if (state === 'report:location') {
    const location = parseLocation(formData, bodyRaw)
    if (!location) {
      return twiml(`Didn't catch that.\n\n` + MSG.REPORT_LOCATION)
    }
    const newData = {
      ...data,
      lat: location.lat,
      lng: location.lng,
      typed_address: location.typed_address,
      location_is_pin: location.is_pin
    }
    await saveSession(phone, 'report:species', newData)
    return twiml(MSG.REPORT_SPECIES(data.incident_type))
  }

  if (state === 'report:species') {
    const species = SPECIES_MAP[body]
    if (!species) {
      return twiml(`Please reply with a number 1-5.\n\n` + MSG.REPORT_SPECIES(data.incident_type))
    }
    await saveSession(phone, 'report:severity', { ...data, species })
    return twiml(MSG.REPORT_SEVERITY)
  }

  if (state === 'report:severity') {
    const severity = SEVERITY_MAP[body]
    if (!severity) {
      return twiml(`Please reply with 1, 2, or 3.\n\n` + MSG.REPORT_SEVERITY)
    }
    await saveSession(phone, 'report:landmark', { ...data, severity })
    return twiml(MSG.REPORT_LANDMARK)
  }

  if (state === 'report:landmark') {
    if (!bodyRaw || bodyRaw.length < 3) {
      return twiml(`Please describe the exact spot in a few words.\n\n` + MSG.REPORT_LANDMARK)
    }
    await saveSession(phone, 'report:consent', { ...data, landmark: bodyRaw })
    return twiml(MSG.REPORT_CONSENT(data.species || 'animal'))
  }

  if (state === 'report:consent') {
    const consented = ['1', 'yes', 'y', 'haan', 'ha'].includes(body)
    const phoneShared = consented

    const { data: submitResult, error: submitError } = await supabase.rpc(
      'submit_whatsapp_incident',
      {
        p_reporter_phone: phone,
        p_species:        data.species || 'Dog',
        p_severity:       data.severity || 'medium',
        p_landmark_text:  data.landmark || 'No landmark provided',
        p_lat:            data.lat || null,
        p_lng:            data.lng || null,
        p_phone_shared:   phoneShared,
        p_incident_type:  data.incident_type || 'accident_medical'
      }
    )

    await clearSession(phone)

    if (submitError || !submitResult || submitResult.length === 0) {
      console.error('[bot] submit_whatsapp_incident failed:', submitError)
      return twiml(`There was a problem submitting your report. Please try again or call +919830000011.`)
    }

    const { incident_id, area_name, has_coordinates } = submitResult[0]

    fireRescuerAlerts(
      incident_id,
      data.species || 'Dog',
      data.severity || 'medium',
      area_name,
      data.landmark || ''
    ).catch(e => console.error('[bot] fireRescuerAlerts async error:', e))

    if (has_coordinates) {
      return twiml(MSG.REPORT_SUBMITTED_WITH_COORDS(data.species || 'animal', area_name, phoneShared))
    } else {
      return twiml(MSG.REPORT_SUBMITTED_NO_COORDS(data.species || 'animal', phoneShared))
    }
  }

  if (state === 'join:role') {
    const role = ROLE_MAP[body]
    if (!role) {
      return twiml(`Please reply with a number 1-4.\n\n` + MSG.JOIN_ROLE)
    }
    await saveSession(phone, 'join:name', { role })
    return twiml(MSG.JOIN_NAME)
  }

  if (state === 'join:name') {
    if (!bodyRaw || bodyRaw.length < 2) {
      return twiml(`Please tell us your full name.`)
    }
    await saveSession(phone, 'join:location', { ...data, name: bodyRaw })
    return twiml(MSG.JOIN_LOCATION)
  }

  if (state === 'join:location') {
    const location = parseLocation(formData, bodyRaw)
    const newData = { ...data }
    if (location) {
      newData.lat = location.lat
      newData.lng = location.lng
      newData.typed_address = location.typed_address
    }

    const geoPoint = (newData.lat && newData.lng)
      ? `SRID=4326;POINT(${newData.lng} ${newData.lat})`
      : null

    const { error: userError } = await supabase.from('users').upsert({
      full_name:        newData.name,
      phone_number:     phone,
      user_role:        newData.role,
      is_verified:      false,
      current_location: geoPoint
    }, { onConflict: 'phone_number' })

    await clearSession(phone)

    if (userError) {
      console.error('[bot] user insert failed:', userError)
      return twiml(`Registration error. Please try again or contact +919830000011.`)
    }

    return twiml(MSG.JOIN_SUBMITTED(newData.name, ROLE_LABEL_MAP[newData.role] || newData.role))
  }

  if (body === '1') {
    return handleRescueAccept(fromRaw, session)
  }

  if (body === '2') {
    return twiml(`Understood. Thank you for letting us know.`)
  }

  return twiml(MSG.UNKNOWN)
}