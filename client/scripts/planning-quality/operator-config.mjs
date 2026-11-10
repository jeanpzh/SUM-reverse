// Explicit live-test configuration only; never loaded by the application or CI.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const allowed = new Set(['AWS_REGION', 'AWS_BEARER_TOKEN_BEDROCK_FILE', 'AWS_BEARER_TOKEN_BEDROCK', 'SUM_BEDROCK_MODEL', 'SUM_LLM_MODEL'])
export async function qualityProviderConfig(root) {
  if (process.env.SUM_QUALITY_USE_BEDROCK !== '1') throw new Error('Live provider evaluation requires SUM_QUALITY_USE_BEDROCK=1')
  const configured = {}
  const path = resolve(root, 'planning-engine/.env')
  for (const line of (await readFile(path, 'utf8')).split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (match && allowed.has(match[1])) configured[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  for (const key of allowed) if (process.env[key]) configured[key] = process.env[key]
  if (!configured.AWS_BEARER_TOKEN_BEDROCK && !configured.AWS_BEARER_TOKEN_BEDROCK_FILE) throw new Error('No explicitly configured Bedrock key')
  if (configured.AWS_BEARER_TOKEN_BEDROCK_FILE?.split(/[\\/]/).includes('datos-reales')) throw new Error('Private directory denied')
  return { ...configured, SUM_LLM_PROVIDER: 'bedrock_converse', AWS_EC2_METADATA_DISABLED: 'true', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true' }
}
