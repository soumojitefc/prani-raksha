// app/api/whatsapp-bot/route.js
//
// Single entry point for ALL incoming WhatsApp messages.
// Replaces the old /api/whatsapp-reply route entirely.
//
// Set this URL in Twilio Console:
//   Messaging → Sandbox → "When a message comes in":
//   https://prani-raksha.vercel.app/api/whatsapp-bot  [HTTP POST]
//
// Architecture:
//   Every message → get session from DB → route to correct handler
//   → handler returns { nextState, nextData, replyText }
//   → save session → send TwiML reply
//
// The session state machine:
//   idle → menu → report:location → report:species → report:severity
//        → report:landmark → report:consent → [submit] → idle
//   idle → menu → join:role → join:name → join:location → [submit] → idle
//   idle → menu → authority → idle

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
// Defined once here. Easy to update without touching logic.
// =============================================================================

const MSG = {
  MENU: `🐾 *Prani Raksha — Kolkata Street Animal Rescue*

What do you need help with?

1️⃣ Report injured or sick animal
2️⃣ Report animal cruelty
3️⃣ Join our rescue network
4️⃣ Contact authorities (police / KMC)

_Reply with a number_`,

  REPORT_LOCATION: `📍 *Step 1 of 4 — Location*

Where is the animal right now?

*Best option:* Tap the 📎 clip icon → Location → Send Current Location

*No GPS?* Just type the nearest landmark:
_"Near Gariahat crossing petrol pump"_
_"Opp Magnolia Skyview gate Kalikapur"_

Anything searchable on Google Maps works.`,

  REPORT_SPECIES: (incidentType) =>
    `${incidentType === 'cruelty' ? '🚨 *Cruelty Report*' : '🏥 *Rescue Report*'}

*Step 2 of 4 — Animal type*

What animal needs help?

1️⃣ Dog
2️⃣ Cat
3️⃣ Cow
4️⃣ Bird
5️⃣ Other`,

  REPORT_SEVERITY: `*Step 3 of 4 — Condition*

How bad is it?

1️⃣ 🚨 Critical — cannot move, bleeding, unconscious
2️⃣ ⚠️ Urgent — injured but mobile, visibly suffering
3️⃣ ℹ️ Needs attention — sick, mange, trapped but stable`,

  REPORT_LANDMARK: `*Step 4 of 4 — Exact spot*

Describe exactly where the animal is.
The rescuer will read this to find them.

Example: _"Behind the blue gate, near the chai stall, dog is under the parked truck"_

One line is enough. Type anything that helps.`,

  REPORT_CONSENT: (species) =>
    `Almost done — one quick question.

May we share your WhatsApp number with the rescuer who accepts this rescue?

1️⃣ Yes, share my number
   _(helps the rescuer find the ${species.toLowerCase()} faster)_

2️⃣ No, keep me anonymous
   _(we respect your privacy — report still goes through immediately)_

_Reply 1 or 2_`,

  REPORT_SUBMITTED_WITH_COORDS: (species, areaName, sharedNumber) =>
    `✅ *Report submitted!*

Rescuers near *${areaName}* are being alerted now.

${sharedNumber
  ? `📞 Your number will be shared only with the rescuer who accepts.`
  : `🔒 You chose to stay anonymous — that's completely fine.`}

You'll get a message here when a rescuer accepts the ${species.toLowerCase()} rescue.

🙏 Thank you for helping.`,

  REPORT_SUBMITTED_NO_COORDS: (species, sharedNumber) =>
    `✅ *Report submitted!*

No GPS coordinates — rescuers will navigate using your landmark description.

${sharedNumber
  ? `📞 Your number will be shared with the rescuer so they can call you for directions.`
  : `🔒 You chose to stay anonymous. The rescuer will use your landmark description.`}

You'll get a message when a rescuer accepts the ${species.toLowerCase()} rescue.

🙏 Thank you for helping.`,

  JOIN_ROLE: `👋 *Join Prani Raksha Network*

What is your role?

1️⃣ Rescuer — I can go to the spot and help
2️⃣ Feeder — I regularly feed street animals
3️⃣ Transporter — I have a vehicle (toto/auto/car)
4️⃣ Vet Clinic / Shelter — I can treat animals`,

  JOIN_NAME: `What is your full name?`,

  JOIN_LOCATION: `📍 Share your area location so we can match you with nearby incidents.

Tap 📎 clip → Location → Send Current Location

OR type your neighbourhood:
_"Shyambazar"_ or _"Behala Chowrasta"_`,

  JOIN_SUBMITTED: (name, role) =>
    `✅ *Registration received!*

Welcome, ${name} 🐾

Role: *${role}*

Our admin will verify your details within 24 hours. Once verified, you'll start receiving rescue alerts near your area.

For questions: +919830000011`,

  AUTHORITY: `📋 *Reporting to Authorities*

*KMC Animal Welfare Cell*
📞 1800-103-4204 (toll free)

*Kolkata Police PCR*
📞 100

*West Bengal SPCA*
📞 033-2249-0946

*For cruelty cases:*
We can help you file a complaint under the Prevention of Cruelty to Animals Act. Text *FIR* and we'll guide you through it.`,

  ISSUE_RECEIVED: `⚠️ Your concern has been logged.

Our admin will review this within 24 hours. If you feel unsafe, please call Kolkata Police at 100.

Thank you for letting us know.`,

  UNKNOWN: `I didn't understand that. 

Text *HI* to see the main menu.

For emergency rescue: text *HELP*
To accept a rescue: text *1*
Status updates: *ONSITE* • *CLINIC* • *DONE*`,

  HELP_SHORTCUT: `🚨 *Emergency rescue report*

Where is the animal? Share your location or type the nearest landmark now.`,
}

// =============================================================================
// SPECIES MAP
// =============================================================================
const SPECIES_MAP = {
  '1': 'Dog', '2': 'Cat', '3': 'Cow', '4': 'Bird', '5': 'Other'
}

const SEVERITY_MAP = {
  '1': 'critical_survival',
  '2': 'medium',
  '3': 'low'
}

const ROLE_MAP = {
  '1': 'rescuer',
  '2': 'feeder',
  '3': 'transporter',
  '4': 'vet_clinic'
}

const ROLE_LABEL_MAP = {
  'rescuer': 'Rescuer',
  'feeder': 'Feeder',
  'transporter': 'Transporter',
  'vet_clinic': 'Vet Clinic / Shelter'
}

// =============================================================================
// LOCATION PARSER
// Handles both Twilio's WhatsApp location message format and plain text.
// Twilio sends location as separate form fields: Latitude, Longitude, Address
// =============================================================================
function parseLocation(formData, bodyText) {
  // Twilio sends these fields when user shares a WhatsApp location pin
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

  // No pin — store whatever they typed as the address
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
// TWIML RESPONSE BUILDER
// =============================================================================
function twiml(message) {
  // Escape XML special characters in message text
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
  )
}

// =============================================================================
// SESSION HELPERS — direct table ops, RPC bypassed (was silently failing)
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
  if (!data) {
    return { state: 'idle', partial_data: {} }
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { state: 'idle', partial_data: {} }
  }
  // partial_data is jsonb — Supabase returns it already parsed as an object
  // Guard against any corrupted row that stored a raw string
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

  if (error) {
    // Log but never throw — a failed session save must not crash the reply
    console.error('[SESSION SAVE ERROR]', phone, state, error.message)
  }
}

async function clearSession(phone) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .delete()
    .eq('phone_number', phone)

  if (error) {
    console.error('[SESSION CLEAR ERROR]', phone, error.message)
  }
}

// =============================================================================
// FIRE ALERTS TO NEARBY RESCUERS
// Called after incident is submitted. Non-blocking — errors are logged not thrown.
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

    const severityLabel = severity === 'critical_survival' ? '🚨 CRITICAL'
      : severity === 'medium' ? '⚠️ URGENT' : 'ℹ️ LOW'

    const alertMsg = (
      `*PRANI RAKSHA ALERT* 🐾\n` +
      `${severityLabel} | ${species} | ${areaName}\n\n` +
      `📌 ${landmarkText}\n\n` +
      `Reply *1* to ACCEPT this rescue\n` +
      `Reply *2* to skip\n\n` +
      `ID: ${incidentId.substring(0, 8)}`
    )

    // Store the pending incident ID in a shared place rescuers can look up
    // We use a 90-second collection window — see ACCEPT handler below
    // Tag all alerts with the incidentId so the reply handler knows context
    await Promise.allSettled(
      unalerted.map(async (rescuer) => {
        const toNumber = rescuer.phone_number.startsWith('+')
          ? `whatsapp:${rescuer.phone_number}`
          : `whatsapp:+91${rescuer.phone_number}`

        let sid = null
        let status = 'failed'

        try {
          const msg = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_FROM,
            to: toNumber,
            body: alertMsg
          })
          sid = msg.sid
          status = 'sent'
        } catch (e) {
          console.error(`[bot] Twilio failed for ${rescuer.phone_number}:`, e.message)
        }

        await supabase.from('alert_log').upsert({
          incident_id: incidentId,
          rescuer_id: rescuer.rescuer_id,
          phone_number: rescuer.phone_number,
          message_sid: sid,
          delivery_status: status
        }, { onConflict: 'incident_id,rescuer_id', ignoreDuplicates: true })
      })
    )
  } catch (err) {
    console.error('[bot] fireRescuerAlerts error:', err)
  }
}

// =============================================================================
// NOTIFY REPORTER — called when rescuer accepts
// =============================================================================
async function notifyReporter(reporterPhone, rescuerName, species) {
  if (!reporterPhone) return
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${reporterPhone}`,
      body: (
        `🐾 *Update on your report*\n\n` +
        `*${rescuerName}* has accepted the ${species.toLowerCase()} rescue and is on the way.\n\n` +
        `If you're still near the animal, please stay close if it's safe to do so.\n\n` +
        `Thank you for reporting. 🙏`
      )
    })
  } catch (e) {
    console.error('[bot] notifyReporter failed:', e.message)
  }
}

// =============================================================================
// HANDLE RESCUE ACCEPTANCE ("1" reply from rescuer)
// 90-second window + closest-wins logic via PostGIS
// =============================================================================
async function handleRescueAccept(phone, session) {
  const normalizedPhone = phone.replace('whatsapp:', '')

  // Find their most recent pending alert
  const { data: alertData } = await supabase
    .from('alert_log')
    .select('incident_id, rescuer_id, alert_fired_at')
    .eq('phone_number', normalizedPhone)
    .eq('delivery_status', 'sent')
    .order('alert_fired_at', { ascending: false })
    .limit(1)
    .single()

  if (!alertData) {
    return twiml(
      'No open rescue request found for your number. ' +
      'The incident may already have been accepted. Thank you! 🙏'
    )
  }

  const incidentId = alertData.incident_id
  const alertFiredAt = new Date(alertData.alert_fired_at)
  const secondsSinceAlert = (Date.now() - alertFiredAt.getTime()) / 1000

  // Within 90-second window: record their interest, don't assign yet
  // After 90 seconds: PostGIS picks the closest interested rescuer
  if (secondsSinceAlert < 90) {
    // Mark their alert_log as 'interested' — not yet assigned
    await supabase
      .from('alert_log')
      .update({ delivery_status: 'interested' })
      .eq('incident_id', incidentId)
      .eq('rescuer_id', alertData.rescuer_id)

    return twiml(
      `✋ Got it! Confirming assignment within 90 seconds.\n\n` +
      `We assign the rescue to the closest available rescuer.\n` +
      `You'll get a confirmation or update shortly.`
    )
  }

  // Past 90 seconds OR this is the only responder — assign directly
  const { data: acceptResult } = await supabase.rpc('incident_accepted_by_rescuer', {
    p_incident_id: incidentId,
    p_rescuer_phone: normalizedPhone
  })

  if (!acceptResult || acceptResult.length === 0) {
    return twiml('System error. Please try again or call +919830000011.')
  }

  const result = acceptResult[0]

  if (!result.success) {
    return twiml(`Update: ${result.error_reason}. Thank you for responding! 🙏`)
  }

  // Fetch reporter info to notify them + share number if consented
  const { data: incidentRow } = await supabase
    .from('incidents')
    .select('reporter_phone_shared, reporter_whatsapp_number, animal_species, landmark_text')
    .eq('id', incidentId)
    .single()

  const species = incidentRow?.animal_species || 'Animal'
  const landmark = incidentRow?.landmark_text || 'Use GPS coordinates'

  // Notify reporter
  if (incidentRow?.reporter_whatsapp_number) {
    await notifyReporter(incidentRow.reporter_whatsapp_number, result.rescuer_name, species)
  }

  const phoneSection = (incidentRow?.reporter_phone_shared && incidentRow?.reporter_whatsapp_number)
    ? `\n📞 *Reporter's number:* ${incidentRow.reporter_whatsapp_number}\n_(Call them for exact directions — they agreed to share)_`
    : `\n🔒 Reporter chose to stay anonymous. Use landmark below.`

  const mapsSection = result.incident_lat
    ? `\n📍 *Navigate here:*\nhttps://www.google.com/maps/dir/?api=1&destination=${result.incident_lat},${result.incident_lng}`
    : ''

  const confirmMsg = (
    `✅ *RESCUE CONFIRMED*\n\n` +
    `You've been assigned this rescue, ${result.rescuer_name}.\n` +
    `${mapsSection}` +
    `${phoneSection}\n\n` +
    `📌 *Exact spot:* ${landmark}\n\n` +
    `Status updates — reply:\n` +
    `*ONSITE* → when you arrive\n` +
    `*CLINIC* → animal is in vehicle\n` +
    `*DONE* → animal admitted to clinic\n\n` +
    `If you have concerns about this case, text *ISSUE*`
  )

  return twiml(confirmMsg)
}

// =============================================================================
// CLOSEST-RESCUER ASSIGNMENT JOB
// Called by a Vercel cron job at /api/assign-closest every 30 seconds.
// Picks the closest 'interested' rescuer for each pending incident.
// Exported here for reuse, triggered externally.
// =============================================================================
export async function assignClosestRescuers() {
  // Find incidents with interested rescuers where alert was fired > 90 seconds ago
  const { data: pendingAlerts } = await supabase
    .from('alert_log')
    .select('incident_id, rescuer_id, phone_number')
    .eq('delivery_status', 'interested')

  if (!pendingAlerts || pendingAlerts.length === 0) return

  // Group by incident
  const byIncident = {}
  for (const alert of pendingAlerts) {
    if (!byIncident[alert.incident_id]) byIncident[alert.incident_id] = []
    byIncident[alert.incident_id].push(alert)
  }

  for (const [incidentId, alerts] of Object.entries(byIncident)) {
    // Check if still unassigned
    const { data: existing } = await supabase
      .from('active_rescuer_assignment')
      .select('incident_id')
      .eq('incident_id', incidentId)
      .single()

    if (existing) continue // already assigned by a direct reply

    // Get all nearby rescuers ordered by distance — first row is closest
    const { data: nearbyOrdered } = await supabase.rpc('get_nearby_rescuers', {
      p_incident_id: incidentId,
      p_radius_meters: 5000.0
    })

    if (!nearbyOrdered || nearbyOrdered.length === 0) continue

    // Find the closest rescuer who expressed interest
    const interestedIds = new Set(alerts.map(a => a.rescuer_id))
    const closestInterested = nearbyOrdered.find(r => interestedIds.has(r.rescuer_id))

    if (!closestInterested) continue

    // Assign them
    const { data: assignResult } = await supabase.rpc('incident_accepted_by_rescuer', {
      p_incident_id: incidentId,
      p_rescuer_phone: closestInterested.phone_number
    })

    if (!assignResult || !assignResult[0]?.success) continue

    const result = assignResult[0]

    // Fetch incident details
    const { data: incidentRow } = await supabase
      .from('incidents')
      .select('reporter_phone_shared, reporter_whatsapp_number, animal_species, landmark_text')
      .eq('id', incidentId)
      .single()

    const species = incidentRow?.animal_species || 'Animal'
    const landmark = incidentRow?.landmark_text || ''

    // Notify the winning rescuer
    const toNumber = closestInterested.phone_number.startsWith('+')
      ? `whatsapp:${closestInterested.phone_number}`
      : `whatsapp:+91${closestInterested.phone_number}`

    const phoneSection = (incidentRow?.reporter_phone_shared && incidentRow?.reporter_whatsapp_number)
      ? `\n📞 *Reporter:* ${incidentRow.reporter_whatsapp_number} _(call for exact location)_`
      : `\n🔒 Reporter is anonymous. Use landmark.`

    const mapsSection = result.incident_lat
      ? `\n📍 https://www.google.com/maps/dir/?api=1&destination=${result.incident_lat},${result.incident_lng}`
      : ''

    try {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: toNumber,
        body: (
          `✅ *RESCUE ASSIGNED TO YOU*\n\n` +
          `You were closest — this ${species.toLowerCase()} rescue is yours.\n` +
          `${mapsSection}` +
          `${phoneSection}\n\n` +
          `📌 ${landmark}\n\n` +
          `Reply: *ONSITE* • *CLINIC* • *DONE*`
        )
      })
    } catch (e) {
      console.error(`[assign] Twilio notify failed for ${closestInterested.phone_number}:`, e.message)
    }

    // Notify others they were not selected
    for (const alert of alerts) {
      if (alert.rescuer_id === closestInterested.rescuer_id) continue
      try {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: alert.phone_number.startsWith('+')
            ? `whatsapp:${alert.phone_number}`
            : `whatsapp:+91${alert.phone_number}`,
          body: (
            `🐾 Thank you for responding!\n\n` +
            `This rescue has been assigned to a rescuer who is closer to the animal.\n\n` +
            `You'll be alerted for the next emergency near you.`
          )
        })
      } catch (e) {
        // Non-critical — just log
        console.error(`[assign] Could not notify non-selected rescuer:`, e.message)
      }
    }

    // Notify reporter
    if (incidentRow?.reporter_whatsapp_number) {
      await notifyReporter(incidentRow.reporter_whatsapp_number, result.rescuer_name, species)
    }
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
export async function POST(request) {
  const formData = await request.formData()
  const fromRaw     = formData.get('From') || ''
  const bodyRaw     = (formData.get('Body') || '').trim()
  const body        = bodyRaw.toLowerCase()

  // Normalize phone: remove "whatsapp:" prefix for DB storage
  const phone = fromRaw.replace('whatsapp:', '')

  if (!phone) return twiml('Message received.')

  // ── Hard keywords — always work regardless of session state ───────────────

  if (body === 'hi' || body === 'hello' || body === 'help' || body === 'menu' || body === 'start') {
    await saveSession(phone, 'menu', {})
    return twiml(MSG.MENU)
  }

  if (body === 'help' || body === 'emergency') {
    await saveSession(phone, 'report:location', { incident_type: 'accident_medical' })
    return twiml(MSG.HELP_SHORTCUT)
  }

  if (body === 'issue') {
    // Rescuer flagging a problem with a reporter
    const { data: active } = await supabase.rpc('get_rescuer_active_incident', {
      p_rescuer_phone: phone
    })
    const incidentId = active?.[0]?.incident_id || null
    const rescuerId  = active?.[0]?.rescuer_id  || null

    await supabase.from('complaint_log').insert({
      reporter_phone: phone,
      rescuer_id:     rescuerId,
      incident_id:    incidentId,
      complaint_text: 'Rescuer raised concern via ISSUE keyword'
    })
    return twiml(MSG.ISSUE_RECEIVED)
  }

  // Status update keywords for active rescuers
  if (['onsite', 'clinic', 'done'].includes(body)) {
    const { data: active } = await supabase.rpc('get_rescuer_active_incident', {
      p_rescuer_phone: phone
    })

    if (!active || active.length === 0) {
      return twiml('No active rescue assignment found for your number.')
    }

    const { incident_id, rescuer_id } = active[0]

    const statusMap = {
      'onsite': 'on_site',
      'clinic': 'hospitalized',
      'done':   'resolved'
    }

    const replyMap = {
      'onsite': `📍 *Status: On Site*\n\nGood luck! When the animal is in the vehicle, text *CLINIC*.`,
      'clinic': `🚗 *Status: In Transit to Clinic*\n\nAlmost there. Text *DONE* once the animal is admitted.`,
      'done':   `✅ *Rescue Complete!*\n\nAmazing work. This rescue has been logged and closed on the Prani Raksha map.\n\n🐾 You'll be alerted for the next emergency near you.\n\nThank you, hero.`
    }

    await supabase
      .from('incidents')
      .update({ status: statusMap[body], updated_at: new Date().toISOString() })
      .eq('id', incident_id)

    await supabase.from('rescuer_reply_log').insert({
      from_number: phone,
      body: bodyRaw,
      incident_id,
      rescuer_id,
      processed: true
    })

    return twiml(replyMap[body])
  }

  // ── Load session ───────────────────────────────────────────────────────────
  const session = await getSession(phone)
  const { state, partial_data: data } = session

  // ── No active session — show menu ─────────────────────────────────────────
  if (state === 'idle') {
    await saveSession(phone, 'menu', {})
    return twiml(MSG.MENU)
  }

  // ── MENU — waiting for 1/2/3/4 ────────────────────────────────────────────
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
    // Not a valid menu choice — re-show menu
    return twiml(MSG.MENU)
  }

  // ── REPORT FLOW ───────────────────────────────────────────────────────────

  if (state === 'report:location') {
    const location = parseLocation(formData, bodyRaw)

    if (!location) {
      // Empty message at location step — re-ask
      return twiml(
        `Didn't catch that.\n\n` + MSG.REPORT_LOCATION
      )
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
    const newData = { ...data, species }
    await saveSession(phone, 'report:severity', newData)
    return twiml(MSG.REPORT_SEVERITY)
  }

  if (state === 'report:severity') {
    const severity = SEVERITY_MAP[body]
    if (!severity) {
      return twiml(`Please reply with 1, 2, or 3.\n\n` + MSG.REPORT_SEVERITY)
    }
    const newData = { ...data, severity }
    await saveSession(phone, 'report:landmark', newData)
    return twiml(MSG.REPORT_LANDMARK)
  }

  if (state === 'report:landmark') {
    if (!bodyRaw || bodyRaw.length < 3) {
      return twiml(`Please describe the exact spot in a few words.\n\n` + MSG.REPORT_LANDMARK)
    }
    const newData = { ...data, landmark: bodyRaw }
    await saveSession(phone, 'report:consent', newData)
    return twiml(MSG.REPORT_CONSENT(data.species || 'animal'))
  }

  if (state === 'report:consent') {
    // Accept 1, 2, yes, no — be forgiving
    const consented = ['1', 'yes', 'y', 'haan', 'ha'].includes(body)
    const declined  = ['2', 'no', 'n', 'nahi', 'nope'].includes(body)

    if (!consented && !declined) {
      // Unrecognised — assume no consent, submit anyway
      // Don't block the report over this
    }

    const phoneShared = consented

    // Submit the incident
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
      return twiml(
        `There was a problem submitting your report. Please try again or call +919830000011.\n\nWe are sorry for the trouble.`
      )
    }

    const { incident_id, area_name, has_coordinates } = submitResult[0]

    // Fire alerts to rescuers asynchronously — don't await, don't block reply
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

  // ── JOIN FLOW ─────────────────────────────────────────────────────────────

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

    // Insert user into DB
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

  // ── "1" in any context — could be rescue accept ───────────────────────────
  if (body === '1') {
    return handleRescueAccept(fromRaw, session)
  }

  if (body === '2') {
    // Decline in unknown context — just acknowledge
    await supabase.from('rescuer_reply_log').insert({
      from_number: phone,
      body: bodyRaw,
      processed: true
    })
    return twiml(`Understood. Thank you for letting us know. 🙏`)
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return twiml(MSG.UNKNOWN)
}