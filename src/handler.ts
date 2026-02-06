import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { quickAddJob } from 'graphile-worker'
import { createRdsPgPool } from 'rds-iam-pg'

import { jsonSchema as inputJsonSchema, Input } from './types/src'
import * as configJsonSchema from './generated/config.schema.json'
import { Config } from './config.schema'

// Use separate Ajv instances to try to dodge (intermittent?) error
// "schema with key or id \"\" already exists".
const inputValidator = addFormats(
  new Ajv({ removeAdditional: true }).addSchema(inputJsonSchema),
)
const configValidator = new Ajv({
  removeAdditional: true,
  coerceTypes: true,
}).addSchema(configJsonSchema)

let pgPool: ReturnType<typeof createRdsPgPool> | undefined

function getPgPool(): ReturnType<typeof createRdsPgPool> {
  if (!pgPool) {
    console.log('Creating RDS pool')
    const config = require('config').util.toObject()
    if (!configValidator.validate('#/definitions/Config', config)) {
      throw Error(configValidator.errorsText(configValidator.errors))
    }

    const validatedConfig = config as Config

    const {
      db: { region: awsRegion, hostname, port, username, databaseName },
      awsProfile,
    } = validatedConfig

    pgPool = createRdsPgPool({
      awsRegion,
      awsProfile,
      max: 1,
      connectionTimeoutMillis: 1000,
      idleTimeoutMillis: 15000,
      address: {
        host: hostname,
        port,
        user: username,
        database: databaseName,
      },
    } as Parameters<typeof createRdsPgPool>[0])
  }
  return pgPool
}

export async function handler(event: Input, context: any): Promise<void> {
  if (!inputValidator.validate('#/definitions/Input', event)) {
    throw Error(inputValidator.errorsText(inputValidator.errors))
  }

  const { taskIdentifier, payload, taskSpec } = event

  console.log('Publishing to queue')
  const pgPool = getPgPool()
  await quickAddJob({ pgPool }, taskIdentifier, payload, taskSpec)
  console.log('Finished publishing to queue')
}
