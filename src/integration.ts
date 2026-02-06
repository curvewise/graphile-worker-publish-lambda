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

describe('graphile-worker-publish Lambda', () => {
  const uniqueFunctionName = `graphile-worker-publish-test-${uuidHex()}`
  const taskIdentifier = 'graphile-worker-publish-test'

  let lambdaFunctionCreated = false
  before('create the unique lambda function', async function () {
    this.timeout('10m')
    if (shouldDeployLambda) {
      console.error(`Using unique function name ${uniqueFunctionName}`)
      await createLambdaFunction(uniqueFunctionName)
      lambdaFunctionCreated = true
    }
  })

  after('delete the unique lambda function', async function () {
    if (lambdaFunctionCreated && shouldCleanupLambda) {
      await deleteLambdaFunction(uniqueFunctionName)
    }
  })

  // TODO: Drain the pool before starting.

  const payload = { 'this-is': ['my', 'payload', uniqueFunctionName] }

  beforeEach('send a message to the lambda function', async function () {
    this.timeout('15s')

    const lambdaPayload: Input = { taskIdentifier, payload }
    const lambdaClient = new LambdaClient({ region: AWS_REGION })
    const command = new InvokeCommand({
      FunctionName: uniqueFunctionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(lambdaPayload),
    })
    const response = await lambdaClient.send(command)

    console.log('response', response)

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
  })

  it('should have been placed in the queue', async function () {
    this.timeout('10s')

    let gotResponse = false

    await runOnce({
      pgPool: createRdsPgPool(RDS_IAM_PG_CONFIG),
      noHandleSignals: false,
      pollInterval: 1000,
      taskList: {
        [taskIdentifier]: _payload => {
          console.log('Received payload', _payload)
          expect(_payload).to.deep.equal(payload)
          gotResponse = true
        },
      },
    })

    expect(gotResponse).to.be.true()
  })
})
