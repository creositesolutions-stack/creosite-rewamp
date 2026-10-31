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

export const BUSINESS_IDEAS = [
  { keywords: ['cafe', 'coffee', 'restaurant', 'bakery', 'food', 'kitchen'], ideas: ['Answer menu, allergy and opening-hour questions at any hour', 'Take table bookings and send reminders', 'Draft replies to reviews and catering enquiries'] },
  { keywords: ['salon', 'barber', 'spa', 'beauty', 'nail'], ideas: ['Book and reschedule appointments without phone calls', 'Send gentle reminders to reduce no-shows', 'Suggest services based on what the client asks for'] },
  { keywords: ['plumb', 'electric', 'build', 'trade', 'repair', 'contract', 'paint', 'carpent'], ideas: ['Ask the right questions and collect job details for quotes', 'Book call-outs into free slots', 'Draft follow-up emails after sending a quote'] },
  { keywords: ['shop', 'store', 'retail', 'boutique', 'ecommerce', 'fashion'], ideas: ['Answer stock, delivery and returns questions', 'Suggest products from what a visitor describes', 'Write product descriptions in your own style'] },
  { keywords: ['clinic', 'dent', 'doctor', 'physio', 'health', 'therap'], ideas: ['Handle appointment requests and reminders', 'Answer common questions about services and preparation', 'Sort enquiries so urgent ones reach you first'] },
  { keywords: ['gym', 'yoga', 'fitness', 'studio', 'coach', 'dance'], ideas: ['Answer class time and membership questions', 'Book trial sessions automatically', 'Draft your weekly class newsletter'] },
  { keywords: ['tutor', 'school', 'teach', 'class', 'academy', 'tuition'], ideas: ['Answer fee, timing and syllabus questions', 'Book demo classes', 'Draft progress updates for parents'] },
]

export const DEFAULT_IDEAS = [
  'Answer your most common customer questions at any hour',
  'Collect enquiry details and send them to your inbox',
  'Draft routine replies for you to review',
]

// Keep this async seam: it can later POST { businessType } to /api/ideas and consume { ideas }.
export async function getIdeas(businessType) {
  const normalized = String(businessType || '').trim().toLowerCase()
  const category = BUSINESS_IDEAS.find(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword)))
  return category ? [...category.ideas] : [...DEFAULT_IDEAS]
}
