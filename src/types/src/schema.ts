import { TaskSpec } from 'graphile-worker'

export interface Input {
  taskIdentifier: string
  payload?: unknown
  taskSpec?: TaskSpec
}
