import path from 'path'
import { createFunction, deleteFunction } from 'werkit'

export const AWS_REGION = 'us-east-1'
export const LAMBDA_ROLE = 'arn:aws:iam::312760052655:role/graphile-worker-publish-lambda-test'
export const SCRATCH_BUCKET = 'goldilocks-scratch-test'
export const TIMEOUT_SECONDS = 10
export const MEMORY_SIZE_MB = 256

export const RDS_IAM_PG_CONFIG = {
  awsRegion: AWS_REGION,
  address: {
    host: 'goldie-graphile-worker.cgbhonktiktk.us-east-1.rds.amazonaws.com',
    port: 48720,
    user: 'writer',
    database: 'test',
  },
}

export const RDS_IAM_ENV_VARS = {
  PG_HOSTNAME: RDS_IAM_PG_CONFIG.address.host,
  PG_PORT: `${RDS_IAM_PG_CONFIG.address.port}`,
  PG_USERNAME: RDS_IAM_PG_CONFIG.address.user,
  PG_DBNAME: RDS_IAM_PG_CONFIG.address.database,
}

const localPathToZipfile = path.resolve(
  __dirname,
  '..',
  'lambdas',
  'graphile-worker-publish.zip',
)

export async function createLambdaFunction(
  functionName: string,
): Promise<void> {
  await createFunction({
    region: AWS_REGION,
    functionName,
    handler: 'handler.handler',
    role: LAMBDA_ROLE,
    localPathToZipfile,
    s3CodeBucket: SCRATCH_BUCKET,
    timeoutSeconds: TIMEOUT_SECONDS,
    memorySizeMb: MEMORY_SIZE_MB,
    verbose: true,
    envVars: RDS_IAM_ENV_VARS,
  })
}

export async function deleteLambdaFunction(
  functionName: string,
): Promise<void> {
  await deleteFunction({ region: AWS_REGION, functionName })
}
