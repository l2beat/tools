import { assert } from '@l2beat/backend-tools'

import { CliParameters, getCliParameters } from './getCliParameters'

export function handleCli(): CliParameters {
  const cli = getCliParameters()
  assert(cli, 'No CLI parameters found')
  return cli
}
