import assert from 'assert'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import chai, { expect } from 'chai'
import dirtyChai from 'dirty-chai'
import { runOnce } from 'graphile-worker'
import { createRdsPgPool } from 'rds-iam-pg'

import {
  AWS_REGION,
  createLambdaFunction,
  deleteLambdaFunction,
  setReservedConcurrency,
  RDS_IAM_PG_CONFIG,
} from './aws-test-helpers'
import { Input } from './types'
import { uuidHex } from './uuid-hex-test-helpers'

chai.use(dirtyChai)

if (process.env.AWS_PROFILE !== 'curvewise') {
  throw Error('Expected the curvewise AWS profile')
}

// For faster iteration on the integration test using an existing Lambda
// deployment, set `shouldCleanupLambda` to false. Then on the next iteration,
// set `shouldDeployLambda` to true and reassign `deploymentEnvironment` below.
const shouldDeployLambda = true
const shouldCleanupLambda = true

// For a stress test, increase this from 10 to 10000.
const numRequests = 10

describe('graphile-worker-publish Lambda', () => {
  let pgPool: ReturnType<typeof createRdsPgPool>
  before(async () => {
    pgPool = createRdsPgPool(RDS_IAM_PG_CONFIG)
  })

  const taskIdentifier = 'graphile-worker-publish-test'

  before('drain the queue', async function () {
    this.timeout('10m')
    let requestCount = 0
    console.log(`Draining existing messages from the ${taskIdentifier} queue`)
    await runOnce({
      pgPool,
      noHandleSignals: false,
      pollInterval: 10,
      taskList: {
        [taskIdentifier]: () => {
          requestCount += 1
        },
      },
    })
    console.log(`Drained ${requestCount} messages from the ${taskIdentifier} queue`)
  })

  const uniqueFunctionName = `graphile-worker-publish-test-${uuidHex()}`

  let lambdaFunctionCreated = false
  before('create the unique lambda function', async function () {
    this.timeout('10m')
    if (shouldDeployLambda) {
      console.error(`Using unique function name ${uniqueFunctionName}`)
      await createLambdaFunction(uniqueFunctionName)
      if (numRequests > 20) {
          await setReservedConcurrency(uniqueFunctionName, 20)
      }
      lambdaFunctionCreated = true
    }
  })

  after('delete the unique lambda function', async function () {
    if (lambdaFunctionCreated && shouldCleanupLambda) {
      await deleteLambdaFunction(uniqueFunctionName)
    }
  })

  const payload = { 'this-is': ['my', 'payload', uniqueFunctionName] }

  beforeEach('send a message to the lambda function', async function () {
    this.timeout('10m')

    const lambdaPayload: Input = { taskIdentifier, payload }
    const lambdaClient = new LambdaClient({ region: AWS_REGION })
    const command = new InvokeCommand({
      FunctionName: uniqueFunctionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(lambdaPayload),
    })

    for (let i = 0; i < numRequests; i++) {
      const response = await lambdaClient.send(command)

      if (response.StatusCode !== 200) {
        console.error(JSON.stringify(response, undefined, 2))
      }
      expect(response.StatusCode).to.equal(200)
      assert.ok(response.Payload)

      if (response.FunctionError) {
        const payload = JSON.parse(Buffer.from(response.Payload).toString())
        console.log(payload.trace.join('\n'))
      }
      expect(response).not.to.have.property('FunctionError')
      console.log(`Invoked lambda ${i + 1} of ${numRequests}`)
    }
  })

  it('should have been placed in the queue', async function () {
    this.timeout('2m')

    let responseCount = 0

    await runOnce({
      pgPool,
      noHandleSignals: false,
      pollInterval: 10,
      taskList: {
        [taskIdentifier]: _payload => {
          expect(_payload).to.deep.equal(payload)
          responseCount += 1
          console.log(`Received ${responseCount} of ${numRequests} messages`)
        },
      },
    })

    expect(responseCount).to.equal(numRequests)
  })
})
