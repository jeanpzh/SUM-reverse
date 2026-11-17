import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { liveEngineEnvironment } from './start-planning-engine-live.mjs'

test('interactive engine always enables the explicit provider and does not inherit test or private runtime settings', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'planning-live-config-'))
  try {
    await writeFile(join(folder, 'key'), 'synthetic-placeholder')
    await writeFile(join(folder, 'operator.env'), 'AWS_REGION=us-east-2\nAWS_BEARER_TOKEN_BEDROCK_FILE=key\nSUM_BEDROCK_MODEL=synthetic-model\nSUM_LLM_PROVIDER=disabled\nSUM_RAG_GENERATION_MODE=extractive\nMATRICULA_SNAPSHOT_DIR=/denied\n')
    const env = await liveEngineEnvironment(join(folder, 'operator.env'), { PORT: '3637', SUM_LLM_PROVIDER: 'disabled', SUM_RAG_GENERATION_MODE: 'extractive', SUM_RAG_CORPUS_PATH: '/untrusted' })
    assert.equal(env.SUM_LLM_PROVIDER, 'bedrock_converse')
    assert.equal(env.SUM_RAG_GENERATION_MODE, undefined)
    assert.equal(env.MATRICULA_SNAPSHOT_DIR, undefined)
    assert.equal(env.SUM_RAG_CORPUS_PATH, undefined)
    assert.equal(env.AWS_REGION, 'us-east-2')
    assert.equal(env.AWS_BEARER_TOKEN_BEDROCK_FILE, join(folder, 'key'))
    assert.equal(env.PORT, '3637')
    assert.equal(env.AWS_CONFIG_FILE, '/dev/null')
    assert.equal(env.AWS_SHARED_CREDENTIALS_FILE, '/dev/null')
    await assert.rejects(liveEngineEnvironment(join(folder, 'operator.env'), { PORT: '0' }), /Invalid engine port/)
    await writeFile(join(folder, 'missing.env'), 'SUM_LLM_PROVIDER=bedrock_converse\n')
    await assert.rejects(liveEngineEnvironment(join(folder, 'missing.env'), {}), /Explicit Bedrock credentials/)
    // This is an empty, independently synthetic directory for testing the deny boundary.
    await mkdir(join(folder, 'datos-reales'))
    await symlink(join(folder, 'datos-reales'), join(folder, 'alias'))
    await assert.rejects(liveEngineEnvironment(join(folder, 'datos-reales', 'config'), {}), /Private directory denied/)
    await assert.rejects(liveEngineEnvironment(join(folder, 'alias'), {}), /Private directory denied/)
  } finally { await rm(folder, { recursive: true, force: true }) }
})
