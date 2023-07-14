import assert from 'assert'
import AWS from 'aws-sdk'
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

  beforeEach('send a message to the lambda function', async function () {
    this.timeout('15s')

    const taskPayload = { 'this-is': ['my', 'payload'] }
    const payload: Input = {
      taskIdentifier,
      payload: taskPayload,
    }

    const response = await new AWS.Lambda({ region: AWS_REGION })
      .invoke({
        FunctionName: uniqueFunctionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload),
      })
      .promise()

    console.log('response', response)

    if (response.StatusCode !== 200) {
      console.error(JSON.stringify(response, undefined, 2))
    }
    expect(response.StatusCode).to.equal(200)
    assert.ok(response.Payload)

    if (response.FunctionError) {
      const payload = JSON.parse(response.Payload.toString())
      console.log(payload.trace.join('\n'))
    }
    expect(response).not.to.have.property('FunctionError')
  })

  it('should have been placed in the queue', async function () {
    this.timeout('10s')

    let gotResponse = false

    const runner = await runOnce({
      pgPool: createRdsPgPool(RDS_IAM_PG_CONFIG),
      noHandleSignals: false,
      pollInterval: 1000,
      taskList: {
        [taskIdentifier]: _payload => {
          console.log('Received vogue response', _payload)
          gotResponse = true
        },
      },
    })

    expect(gotResponse).to.be.true()
  })
})
