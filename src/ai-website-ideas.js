export const DEMO_EXAMPLES = [
  {
    title: 'Answers customer questions',
    freesUp: 'answering the same questions again and again.',
    steps: [
      { type: 'visitor', text: 'Do you deliver on Sundays?' },
      { type: 'assistant', text: 'Yes, we deliver on Sundays between 10am and 2pm. Would you like to place an order?' },
      {
        type: 'chips',
        choices: [
          { label: 'Yes, please', steps: [{ type: 'assistant', text: 'Great. I have passed your request to the team and they will confirm shortly.' }] },
          { label: 'What does delivery cost?', steps: [{ type: 'assistant', text: 'Delivery is free over a set amount and a small fee below it. You set these rules and I follow them.' }] },
        ],
      },
    ],
  },
  {
    title: 'Explain your offering',
    freesUp: 'helping customers understand packages and products.',
    steps: [
      { type: 'assistant', text: 'Choose an offering and ask Creo AI for a quick explanation:' },
      {
        type: 'offerings',
        items: [
          {
            category: 'TOUR PACKAGE',
            title: 'Kerala Backwater Escape',
            theme: 'travel',
            description: 'A four-day Kerala getaway bundles stays, transfers, and guided backwater experiences into one easy-to-plan trip.',
          },
          {
            category: 'DENTAL TREATMENT',
            title: 'Root Canal Treatment',
            theme: 'dental',
            description: 'Root canal treatment removes infected tissue from inside a tooth and seals it to help preserve the natural tooth.',
          },
          {
            category: 'TECH PRODUCT',
            title: 'Everyday Laptop Bundle',
            theme: 'tech',
            description: 'This everyday laptop package pairs a lightweight computer with useful accessories for study and work.',
          },
        ],
      },
    ],
  },
  {
    title: 'Books appointments',
    freesUp: 'phone tag and back-and-forth emails.',
    steps: [
      { type: 'visitor', text: 'Can I book a visit this week?' },
      { type: 'assistant', text: 'Of course. Here are the next free slots:' },
      {
        type: 'chips',
        choices: ['Tue 10:00', 'Wed 14:30', 'Fri 09:00'].map((label) => ({
          label,
          echo: true,
          steps: [
            { type: 'assistant', text: 'Booked for {0}. A confirmation is on its way.' },
            { type: 'card', title: 'BOOKED', lines: ['{0} added to your calendar', 'Reminder sends the day before'] },
          ],
        })),
      },
    ],
  },
  {
    title: 'Collects and sorts enquiries',
    freesUp: 'chasing details before you can quote.',
    steps: [
      { type: 'visitor', text: 'I need a quote for a kitchen refit.' },
      { type: 'assistant', text: 'Happy to help. What is your rough budget?' },
      {
        type: 'chips',
        choices: ['Under 5k', '5k to 10k', 'Over 10k'].map((label) => ({
          label,
          echo: true,
          steps: [
            { type: 'assistant', text: 'And when would you like to start?' },
            {
              type: 'chips',
              choices: ['This month', 'Next month'].map((startDate) => ({
                label: startDate,
                echo: true,
                steps: [{ type: 'card', title: 'NEW ENQUIRY', lines: ['Job: kitchen refit', 'Budget: {0}', 'Start: {1}', 'Sent to your inbox'] }],
              })),
            },
          ],
        })),
      },
    ],
  },
  {
    title: 'Drafts replies for you',
    freesUp: 'typing out routine replies.',
    steps: [
      { type: 'visitor', text: 'Hi, is my order still on its way? Sam' },
      { type: 'assistant', text: 'Here is a suggested reply for you to review:' },
      { type: 'card', title: 'DRAFT', lines: ['Hi Sam, thanks for getting in touch. Your order is on its way and should arrive tomorrow. Let us know if you need anything else.'] },
      {
        type: 'chips',
        choices: [
          { label: 'Send as is', steps: [{ type: 'card', title: 'SENT', lines: ['Reply sent to Sam'] }] },
          { label: 'Make it friendlier', steps: [{ type: 'card', title: 'DRAFT', lines: ['Hi Sam! Thanks so much for checking in. Your order is on its way and should reach you tomorrow. Shout if you need anything at all.'] }] },
        ],
      },
    ],
  },
  {
    title: 'Speaks your customers’ language',
    freesUp: 'turning customers away because of language.',
    steps: [
      { type: 'assistant', text: 'A customer writes in their own language. Pick one:' },
      {
        type: 'chips',
        choices: [
          { label: 'Español', visitorText: '¿Hacen entregas a domicilio?', lang: 'es', steps: [{ type: 'assistant', text: 'Sí, hacemos entregas a domicilio. ¿Quiere hacer un pedido?' }] },
          { label: 'हिन्दी', visitorText: 'क्या आप होम डिलीवरी करते हैं?', lang: 'hi', steps: [{ type: 'assistant', text: 'जी हाँ, हम होम डिलीवरी करते हैं। क्या आप ऑर्डर देना चाहेंगे?' }] },
          { label: 'മലയാളം', visitorText: 'നിങ്ങൾ ഹോം ഡെലിവറി ചെയ്യുമോ?', lang: 'ml', steps: [{ type: 'assistant', text: 'അതെ, ഞങ്ങൾ ഹോം ഡെലിവറി ചെയ്യുന്നുണ്ട്. ഓർഡർ ചെയ്യണോ?' }] },
        ],
      },
    ],
  },
]

function getSessionId() {
  const key = 'creo-ideas-session'
  try {
    let id = window.sessionStorage.getItem(key)
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.sessionStorage.setItem(key, id)
    }
    return id
  } catch {
    return 'temporary-session'
  }
}

function toChatSafeText(value) {
  return String(value || '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildIdeaDiscussionPrompt(idea, businessType) {
  const titleWords = (toChatSafeText(idea?.title) || 'AI idea').split(/\s+/).filter(Boolean).slice(0, 5)
  const businessWords = (toChatSafeText(businessType) || 'my business').split(/\s+/).filter(Boolean).slice(0, Math.max(1, 10 - titleWords.length))
  const title = titleWords.join(' ')
  const business = businessWords.join(' ')
  const purpose = toChatSafeText(idea?.description) || 'support my business'
  return `I need the idea "${title}" for ${business} to ${purpose}. Can you help?`
}

export async function getIdeas(businessType) {
  const response = await fetch('/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessType, sessionId: getSessionId() }),
  })
  const responseText = await response.text()
  let result
  try {
    result = responseText ? JSON.parse(responseText) : null
  } catch {
    result = null
  }

  if (!response.ok) {
    const error = new Error(result?.message || `The ideas service returned an error (${response.status}). Please try again.`)
    error.status = response.status
    throw error
  }
  if (!result || !Array.isArray(result.ideas)) {
    throw new Error('The AI ideas service returned an empty or invalid response. Please try again, and check that the server is running with its AI API key configured.')
  }
  return result
}
