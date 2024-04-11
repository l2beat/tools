import select from '@inquirer/select'
import { ContractParameters } from '@l2beat/discovery-types'
import chalk from 'chalk'

import { DiscoveryOverridesBuilder } from '../config/DiscoveryOverridesBuilder'
import { DiscoveryDiff } from '../output/diffDiscovery'

interface Change {
  contract: string
  property: string
}

export class InteractiveDiffIgnore {
  constructor(private readonly dob: DiscoveryOverridesBuilder) {}

  async runForDiffs(discoveryDiffs: DiscoveryDiff[]): Promise<void> {
    console.log(chalk.green('Starting interactive mode...'))

    // Filter-out diffs without changes
    const changesWithDiffs: Change[] = discoveryDiffs.flatMap(
      (discoveryDiff) => {
        const contract = discoveryDiff.name
          ? discoveryDiff.name
          : discoveryDiff.address.toString()

        if (!discoveryDiff.diff) {
          return []
        }

        return discoveryDiff.diff.map((d) => ({
          contract,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          property: d.key!,
        }))
      },
    )

    const rootPropsChanged = getRootPropertiesChanged(changesWithDiffs)

    for (const { property, contract: addressOrName } of rootPropsChanged) {
      const contract = this.getContract(addressOrName)

      if (!contract) {
        const msg = `Skipping ${chalk.italic.blue(
          property,
        )} - contract not found`

        console.log(msg)
        continue
      }

      const prettyContractName = getNameWithColor(contract)

      const isIgnoredInWatchMode = this.dob
        .getWatchMode(contract)
        .includes(property)

      if (isIgnoredInWatchMode) {
        const msg = `Skipping ${chalk.italic.blue(
          property,
        )} on ${prettyContractName} - ignored in watch mode`
        console.log(msg)
        continue
      }

      const isIgnoredMethod = this.dob
        .getIgnoredMethods(contract)
        .includes(property)

      if (isIgnoredMethod) {
        const msg = `Skipping ${chalk.italic.blue(
          property,
        )} on ${prettyContractName}- ignored method`
        console.log(msg)
        continue
      }

      const isCustomHandler = this.dob.isCustomHandler(contract, property)

      if (isCustomHandler) {
        const msg = `Skipping ${chalk.italic.blue(
          property,
        )} on ${prettyContractName} - custom handler`
        console.log(msg)
        continue
      }

      await this.configureSingleProperty(contract, property)
    }

    console.log(chalk.green('Flushing overrides...'))
    await this.dob.flushOverrides()
    console.log(
      chalk.green(
        'Done! Run prettier over the config file. Re-run the discovery if needed.',
      ),
    )
  }

  private async configureSingleProperty(
    contract: ContractParameters,
    property: string,
  ): Promise<void> {
    const choices = [
      {
        name: '👁️  Ignore in watch mode',
        value: 'watchmode',
      },
      {
        name: '🙅 Ignore method',
        value: 'method',
      },
      {
        name: '⏩ Skip',
        value: 'skip',
      },
    ] as const

    const name = getNameWithColor(contract)

    const message = `Configure ${chalk.italic.blue(
      property,
    )} visibility on ${name}: `

    const choose = await select({
      message,
      choices,
    })

    if (choose === 'watchmode') {
      const currWatchMode = this.dob.getWatchMode(contract)

      this.dob.setOverride(contract, {
        ignoreInWatchMode: [...currWatchMode, property],
      })
    }

    if (choose === 'method') {
      const currIgnoredMethods = this.dob.getIgnoredMethods(contract)

      this.dob.setOverride(contract, {
        ignoreMethods: [...currIgnoredMethods, property],
      })
    }

    // choose === 'skip'
    return
  }

  private getContract(nameOrAddress: string): ContractParameters | null {
    return this.dob.getContracts().find((c) => c.name === nameOrAddress) ?? null
  }
}

function getNameWithColor(contract: ContractParameters): string {
  const hasName = Boolean(contract.name)

  if (hasName) {
    return `${chalk.yellowBright(
      contract.name,
    )} (${contract.address.toString()})`
  }

  return `${contract.address.toString()}`
}

function getRootPropertiesChanged(changes: Change[]): Change[] {
  const rootPropertiesChanged = changes
    // Double-check if it is a value change
    .filter((change) => change.property.startsWith('values.'))
    // Strip array index
    // values.foo[1] -> values.foo
    .map((change) => ({
      ...change,
      property: change.property.replace(/\[\d+\]/, ''),
    }))
    // Strip values.
    // values.foo -> foo
    .map((change) => ({
      ...change,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      property: change.property.split('.')[1]!,
    }))

  const unique = new Map<string, Change>()

  for (const change of rootPropertiesChanged) {
    const identifier = `${change.contract}-${change.property}`
    if (!unique.has(identifier)) {
      // We do not care about nested changes, since we only ignore root properties
      unique.set(identifier, change)
    }
  }

  return Array.from(unique.values())
}
