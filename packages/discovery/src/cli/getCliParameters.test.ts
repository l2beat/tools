import { expect } from 'earl'

import { ChainId } from '../utils/ChainId'
import { EthereumAddress } from '../utils/EthereumAddress'
import { getCliParameters } from './getCliParameters'

describe(getCliParameters.name, () => {
  const baseArgs = ['node', 'discovery']
  it('server', () => {
    const cli = getCliParameters([...baseArgs, 'server'])
    expect(cli).toEqual({ mode: 'server' })
  })

  it('discover foo', () => {
    const cli = getCliParameters([...baseArgs, 'discover', 'ethereum', 'foo'])
    expect(cli).toEqual({
      mode: 'discover',
      chain: ChainId.fromName('ethereum'),
      project: 'foo',
      dryRun: false,
      dev: false,
      sourcesFolder: undefined,
      discoveryFilename: undefined,
      blockNumber: undefined,
    })
  })

  it('discover foo --dry-run', () => {
    const cli = getCliParameters([
      ...baseArgs,
      'discover',
      'ethereum',
      'foo',
      '--dry-run',
    ])
    expect(cli).toEqual({
      mode: 'discover',
      chain: ChainId.fromName('ethereum'),
      project: 'foo',
      dryRun: true,
      dev: false,
      sourcesFolder: undefined,
      discoveryFilename: undefined,
      blockNumber: undefined,
    })
  })

  it('discover --dev foo --sources-folder=.code@1234 --discovery-filename=discovery@1234.json', () => {
    const cli = getCliParameters([
      ...baseArgs,
      'discover',
      '--dev',
      'ethereum',
      'foo',
      '--sources-folder=.code@1234',
      '--discovery-filename=discovery@1234',
    ])
    expect(cli).toEqual({
      mode: 'discover',
      chain: ChainId.fromName('ethereum'),
      project: 'foo',
      dryRun: false,
      dev: true,
      sourcesFolder: '.code@1234',
      discoveryFilename: 'discovery@1234',
      blockNumber: undefined,
    })
  })

  it('discover ethereum --block-number=5678 foo --dry-run', () => {
    const cli = getCliParameters([
      ...baseArgs,
      'discover',
      'ethereum',
      '--block-number=5678',
      'foo',
      '--dry-run',
    ])
    expect(cli).toEqual({
      mode: 'discover',
      chain: ChainId.fromName('ethereum'),
      project: 'foo',
      dryRun: true,
      dev: false,
      sourcesFolder: undefined,
      discoveryFilename: undefined,
      blockNumber: 5678,
    })
  })

  it('invert ethereum --mermaid foo', () => {
    const cli = getCliParameters([
      ...baseArgs,
      'invert',
      'ethereum',
      '--mermaid',
      'foo',
    ])

    expect(cli).toEqual({
      mode: 'invert',
      chain: ChainId.fromName('ethereum'),
      project: 'foo',
      useMermaidMarkup: true,
    })
  })

  it('single-discovery ethereum 0x77777...77777', () => {
    const cli = getCliParameters([
      ...baseArgs,
      'single-discovery',
      'ethereum',
      '0x7777777777777777777777777777777777777777',
    ])

    expect(cli).toEqual({
      mode: 'single-discovery',
      chain: ChainId.fromName('ethereum'),
      address: EthereumAddress('0x7777777777777777777777777777777777777777'),
    })
  })
})
