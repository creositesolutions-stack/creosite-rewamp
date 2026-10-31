import { flushLangSmith } from '../server/langsmith.js'
import { purgeExpiredConversations } from '../server/conversations.js'

const retentionDays = Number(process.env.CONVERSATION_RETENTION_DAYS)

if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
  console.error('Set CONVERSATION_RETENTION_DAYS to a positive number before running retention cleanup.')
  process.exitCode = 1
} else {
  try {
    const deleted = await purgeExpiredConversations(retentionDays)
    await flushLangSmith()
    console.log(`Deleted ${deleted} expired conversation${deleted === 1 ? '' : 's'} older than ${retentionDays} days.`)
    console.log('LangSmith traces are retained separately and are not deleted by this script.')
  } catch (error) {
    console.error('Conversation retention cleanup failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
