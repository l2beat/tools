import { ContractSource } from '../utils/EtherscanLikeClient'
import { compile } from 'solc'

// ts-node src/cli.ts layout ethereum 0x32400084C286CF3E17e7B677ea9583e60a000324 0xa389bf185b301c8e20e79e3098e71399914035df 0x91ca046dad8c3db41f296267e1720d9c940f613d 0x2ea0cfb9c942058ee5a84411ef2e37c6de5bfe5c 0x7ed066718dfb1b2b04d94780eca92b67ecf3330b 0xc796a402e1b26ecd2cd38f23e05a2f904504ec89 0x389a081bcf20e5803288183b929f08458f1d863d 0xb91d905a698c28b73c61af60c63919b754fcf4de 0xdc7c3d03845efe2c4a9e758a70a68ba6bba9fac4 0x5349e94435cc9cab9ffb40a492da46935052733a 0x9b1a10bdc4a40219544c835263b2ca3f3e689693 0xa7e8a8f71c3cc43946601cc99997f8cd6828a9b9 0x98e900eb2e5fde9786f736e86d6bfbfdb3e4683b 0x62aa95ac4740a367746a664c4c69034d52e968ef 0x16615a85b451edfb6fcbea0b34405d9c7ca1a22a 0xb2097dbe4410b538a45574b1fcd767e2303c7867 0xc48d496459e1358d055a79173bea41efb7449028

export function getLayout(sources: ContractSource[]): string {
  for (const source of sources) {
    const mainContract = source.ContractName
    const map: any = parseContractSource(source.SourceCode)
    map.settings.outputSelection = { '*': { '*': ['storageLayout'] } }
    const out = JSON.parse(compile(JSON.stringify(map)))
    for (const contracts of Object.values(out.contracts) as any[]) {
      // TODO: better selection of main contract
      const contract = contracts[mainContract]
      if (contract) {
        console.log(JSON.stringify(contract.storageLayout, null, 2))
      }
    }
  }
  return ''
}

function parseContractSource(source: string): unknown {
  if (source.startsWith('{{') && source.endsWith('}}')) {
    return JSON.parse(source.slice(1, -1))
  }
  return JSON.parse(source)
}
