import { assert } from '@l2beat/backend-tools'
import { DiscoveryOutput } from '@l2beat/discovery-types'
import { readdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { parse, ParseError } from 'jsonc-parser'

import { ChainId } from '../../utils/ChainId'
import { DiscoveryConfig } from './DiscoveryConfig'
import { RawDiscoveryConfig } from './RawDiscoveryConfig'
import { fileExistsCaseSensitive } from '../../utils/fsLayer'

export class ConfigReader {
  async readConfig(name: string, chain: ChainId): Promise<DiscoveryConfig> {
    const chainName = ChainId.getName(chain).toString()
    assert(fileExistsCaseSensitive(`discovery/${name}`), "Project not found, check if case matches")
    assert(fileExistsCaseSensitive(`discovery/${name}/${chainName}`), "Chain not found in project, check if case matches")

    const contents = await readFile(
      `discovery/${name}/${chainName}/config.jsonc`,
      'utf-8',
    )
    const errors: ParseError[] = []
    const parsed: unknown = parse(contents, errors, {
      allowTrailingComma: true,
    })
    if (errors.length !== 0) {
      throw new Error('Cannot parse file')
    }
    const rawConfig = RawDiscoveryConfig.parse(parsed)
    const config = new DiscoveryConfig(rawConfig)

    assert(config.chainId === chain, 'Chain ID mismatch in config.jsonc')

    return config
  }

  async readDiscovery(name: string, chain: ChainId): Promise<DiscoveryOutput> {
    const chainName = ChainId.getName(chain).toString()
    assert(fileExistsCaseSensitive(`discovery/${name}`), "Project not found, check if case matches")
    assert(fileExistsCaseSensitive(`discovery/${name}/${chainName}`), "Chain not found in project, check if case matches")

    const contents = await readFile(
      `discovery/${name}/${chainName}/discovered.json`,
      'utf-8',
    )

    const parsed: unknown = JSON.parse(contents)

    const discovery = parsed as DiscoveryOutput

    assert(
      ChainId.fromName(discovery.chain) === chain,
      'Chain ID mismatch in discovered.json',
    )

    return discovery
  }

  async readAllConfigsForChain(chain: ChainId): Promise<DiscoveryConfig[]> {
    const result: DiscoveryConfig[] = []
    const projects = this.readAllProjectsForChain(chain)

    for (const project of projects) {
      const contents = await this.readConfig(project, chain)
      result.push(contents)
    }

    return result
  }

  readAllProjectsForChain(chain: ChainId): string[] {
    const folders = readdirSync('discovery', { withFileTypes: true }).filter(
      (x) => x.isDirectory(),
    )

    const projects = []

    for (const folder of folders) {
      const contents = readdirSync(`discovery/${folder.name}`, {
        withFileTypes: true,
      })
        .filter((x) => x.isDirectory())
        .map((x) => x.name)

      if (contents.includes(ChainId.getName(chain))) {
        projects.push(folder.name)
      }
    }

    return projects
  }
}
