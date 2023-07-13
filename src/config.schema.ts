export interface Config {
  graphileWorkerDb: {
    region: string
    hostname: string
    port: number
    username: string
    databaseName: string
  }
  awsProfile?: string
}
