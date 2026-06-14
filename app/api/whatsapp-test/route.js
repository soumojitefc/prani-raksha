// Local test endpoint — simulates Twilio POST without sending real messages
// Hit this from browser or Postman instead of WhatsApp
// REMOVE before going to production

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const body = searchParams.get('msg') || 'hi'
  const phone = searchParams.get('phone') || '+919999999999'

  const formData = new FormData()
  formData.set('From', `whatsapp:${phone}`)
  formData.set('Body', body)
  formData.set('To', 'whatsapp:+14155238886')
  formData.set('NumMedia', '0')
  formData.set('MessageType', 'text')

  // Forward to the actual bot handler
  const botResponse = await fetch(
    `${request.nextUrl.origin}/api/whatsapp-bot`,
    { method: 'POST', body: formData }
  )

  const xml = await botResponse.text()

  // Extract message from TwiML and return as plain text
  const match = xml.match(/<Message>([\s\S]*?)<\/Message>/)
  const message = match ? match[1] : xml

  return new Response(message, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}