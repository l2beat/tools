import checkbox from '@inquirer/checkbox'
import select from '@inquirer/select'
import { ContractParameters } from '@l2beat/discovery-types'
import chalk from 'chalk'

import { InteractiveOverridesManager } from './InteractiveOverridesManager'

export class InteractiveOverrides {
  static MAX_PAGE_SIZE = 10

  constructor(private readonly iom: InteractiveOverridesManager) {}

  async run(): Promise<void> {
    console.log(chalk.blue.bold('### Interactive mode ###'))

    for (;;) {
      const message = 'Options: '
      const choices = [
        {
          name: 'Configure contract overrides',
          value: 'configure',
        },
        { name: 'Flush overrides', value: 'flush' },
      ] as const

      const choice = await select({
        message,
        choices,
      })

      if (choice === 'configure') {
        await this.configureContract()
      }

      if (choice === 'flush') {
        await this.iom.flushOverrides()
        break
      }
    }
  }

  async configureContract(): Promise<void> {
    for (;;) {
      const message = 'Configure contract: '

      const choices = this.iom.getContracts().map((contract) => {
        const name = getNameWithColor(contract)

        return {
          name,
          value: contract,
        }
      })

      const contractOrBack = await selectWithBack(message, choices)

      if (contractOrBack === 'back') {
        return
      }

      await this.configureOverrides(contractOrBack)
    }
  }

  async configureOverrides(contract: ContractParameters): Promise<void> {
    for (;;) {
      const message = 'Configure overrides: '
      const choices = [
        {
          name: `🔍 Watch Mode (${chalk.gray('ignoreInWatchMode')})`,
          value: 'watchmode',
        },
        {
          name: `⏭️  Ignore methods (${chalk.gray('ignoreMethods')})`,
          value: 'methods',
        },
        {
          name: `🛑 Ignore Discovery completely (${chalk.gray(
            'ignoreDiscovery',
          )})`,
          value: 'ignore',
        },
      ] as const

      const choice = await selectWithBack(message, choices)

      if (choice === 'watchmode') {
        await this.configureWatchMode(contract)
      }

      if (choice === 'methods') {
        await this.configureIgnoredMethods(contract)
      }

      if (choice === 'ignore') {
        await this.configureIgnoreDiscovery(contract)
      }

      if (choice === 'back') {
        return
      }
    }
  }

  async configureWatchMode(contract: ContractParameters): Promise<void> {
    const { all, ignored } = this.iom.getWatchMode(contract)

    const message =
      'Values hidden in watch-mode (values in ignoreMethods are excluded):'

    const choices = all.map((property) => ({
      name: property,
      value: property,
      // Sync already present configuration
      checked: ignored.includes(property),
    }))

    if (choices.length === 0) {
      noValuesWarning(true)
      return
    }

    const ignoreInWatchMode = await checkbox({
      loop: false,
      pageSize: InteractiveOverrides.MAX_PAGE_SIZE,
      message,
      choices,
    })

    this.iom.setOverride(contract, { ignoreInWatchMode })
  }

  async configureIgnoredMethods(contract: ContractParameters): Promise<void> {
    const ignoredMethods = this.iom.getIgnoredMethods(contract)

    const message = 'Ignored methods: '

    const choices = ignoredMethods.all.map((property) => ({
      name: property,
      value: property,
      // Sync already present configuration
      checked: ignoredMethods.ignored.includes(property),
    }))

    if (choices.length === 0) {
      noValuesWarning()
      return
    }

    const ignoreMethods = await checkbox({
      loop: false,
      pageSize: InteractiveOverrides.MAX_PAGE_SIZE,
      message,
      choices,
    })

    this.iom.setOverride(contract, { ignoreMethods })
  }

  async configureIgnoreDiscovery(contract: ContractParameters): Promise<void> {
    const isDiscoveryIgnored = this.iom.getIgnoreDiscovery(contract)
    const message = 'Ignore discovery: '

    const choices = [
      {
        name: 'yes',
        value: 'ignore',
        checked: isDiscoveryIgnored,
      },
    ] as const

    const choice = await checkbox({
      message,
      choices,
    })

    const ignoreDiscovery = Boolean(choice.length > 0)

    this.iom.setOverride(contract, { ignoreDiscovery })
  }
}

function getNameWithColor(contract: ContractParameters): string {
  const hasName = Boolean(contract.name)

  if (hasName) {
    return `${chalk.yellowBright(
      contract.name,
    )} (${contract.address.toString()}) `
  }

  return `${contract.address.toString()}`
}

interface Choice<T> {
  value: T
  name: string
}
async function selectWithBack<T>(
  message: string,
  choices: Choice<T>[] | readonly Choice<T>[],
): Promise<T | 'back'> {
  const choicesWithBack = [
    ...choices,
    {
      name: 'Back',
      value: 'back',
    } as const,
  ]

  const answer = await select<T | 'back'>({
    loop: false,
    pageSize: InteractiveOverrides.MAX_PAGE_SIZE,
    message,
    choices: choicesWithBack,
  })

  return answer
}

function noValuesWarning(full?: boolean): void {
  let msg = `
  ⚠️ OOPS - no values to manage - check following cases:
  - Discovery is set to ignore this contract
  - Contract has no values discovered`

  if (full) {
    msg += '\n  - All values are ignored via ignoreMethods'
  }

  msg += '\n'

  console.log(chalk.red(msg))
}
