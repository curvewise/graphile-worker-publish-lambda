import Ajv from 'ajv'
import { quickAddJob } from 'graphile-worker'
import { createRdsPgPool } from 'rds-iam-pg'

import { jsonSchema as inputJsonSchema, Input } from './types/src'
import * as configJsonSchema from './generated/config.schema.json'
import { Config } from './config.schema'

const inputValidator = new Ajv({ removeAdditional: true }).addSchema(
  inputJsonSchema,
)
const configValidator = new Ajv({ removeAdditional: true }).addSchema(
  configJsonSchema,
)

let memoizedConfig: Config | undefined
export function getMemoizedConfig(): Config {
  if (!memoizedConfig) {
    const config = require('config').util.toObject()
    if (!configValidator.validate('#/definitions/Config', config)) {
      throw Error(configValidator.errorsText(configValidator.errors))
    }
    memoizedConfig = config as Config
  }
  return memoizedConfig
}

export async function handler(
  event: Input,
  context: any,
  // Inject `getConfig()` to bypass env-based config in unit tests.
  { getConfig = getMemoizedConfig }: { getConfig?: () => Config } = {},
): Promise<void> {
  const config = getConfig()

  const {
    db: { region: awsRegion, hostname, port, username, databaseName },
    awsProfile,
  } = config

  if (!inputValidator.validate('#/definitions/Input', event)) {
    throw Error(inputValidator.errorsText(inputValidator.errors))
  }

  const { taskIdentifier, payload, taskSpec } = event

  console.log('Creating queue client')
  const pgPool = createRdsPgPool({
    awsRegion,
    awsProfile,
    address: {
      host: hostname,
      port,
      user: username,
      database: databaseName,
    },
  })

  try {
    console.log('Publishing to queue')
    await quickAddJob({ pgPool }, taskIdentifier, payload, taskSpec)
    console.log('Finished publishing to queue')
  } finally {
    await pgPool.end()
    console.log('Closed queue client')
  }
}
