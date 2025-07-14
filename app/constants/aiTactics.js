app/constants/aiTactics.js


const aiTactics = [
  {
    id: 'cold-email-outline',
    name: 'Cold Email Outline',
    description:
      'Generate a persuasive cold email structure tailored for outbound B2B outreach.',
    promptTemplate: ({ companyName, industry, valueProp }) => `
You are an expert SDR. Generate a cold email outline for a company named "${companyName}" targeting the ${industry} industry.

The email should:
- Start with a personalized hook relevant to the industry
- Introduce a pain point
- Offer a clear solution via "${valueProp}"
- Include a CTA that encourages response

Keep it concise, direct, and written in a professional tone.
    `.trim(),
    inputFields: ['companyName', 'industry', 'valueProp'],
  },
  {
    id: 'linkedin-connection-message',
    name: 'LinkedIn Connection Message',
    description:
      'Craft a short and engaging LinkedIn connection request message.',
    promptTemplate: ({ recipientRole, commonGround }) => `
You're crafting a LinkedIn connection message for someone in the role of "${recipientRole}". 

Mention this shared connection or commonality: "${commonGround}".

Make it:
- Friendly but professional
- No more than 300 characters
- Likely to get accepted
    `.trim(),
    inputFields: ['recipientRole', 'commonGround'],
  },
  {
    id: 'value-prop-simplifier',
    name: 'Value Proposition Simplifier',
    description:
      'Simplify a complex value proposition into a 1-sentence pitch a 10-year-old can understand.',
    promptTemplate: ({ complexValueProp }) => `
Simplify the following value proposition so a 10-year-old can understand it in one sentence:

"${complexValueProp}"
    `.trim(),
    inputFields: ['complexValueProp'],
  },
  {
    id: 'follow-up-message',
    name: 'Follow-Up Message',
    description:
      'Create a friendly follow-up message after no response to the first cold outreach.',
    promptTemplate: ({ firstMessageSummary, senderName }) => `
You are writing a friendly follow-up message after the recipient hasn't replied to the first cold email.

The first message was about: "${firstMessageSummary}"

Keep it:
- Short and polite
- Show empathy
- Reiterate the benefit
- Signed by "${senderName}"
    `.trim(),
    inputFields: ['firstMessageSummary', 'senderName'],
  },
  {
    id: 'objection-handler',
    name: 'Objection Handler',
    description:
      'Handle a common objection raised by a lead during the sales process.',
    promptTemplate: ({ objection, productName }) => `
As a top SDR, respond to this objection about "${productName}":

"${objection}"

Your response should:
- Empathize with the concern
- Provide clarity or social proof
- Reframe the benefit
- Be professional and concise
    `.trim(),
    inputFields: ['objection', 'productName'],
  },
  {
    id: 'ai-summary-of-call',
    name: 'AI Call Summary Generator',
    description:
      'Summarize a sales call transcription with clear takeaways, next steps, and objections.',
    promptTemplate: ({ transcript }) => `
You are an AI assistant. Summarize the following sales call transcript.

Format:
- Key Points:
- Objections:
- Next Steps:

Transcript:
${transcript}
    `.trim(),
    inputFields: ['transcript'],
  },
]

export default aiTactics