import z from 'zod'

const Sources = z.record(z.object({ content: z.string() }))
const Settings = z.object({ remappings: z.array(z.string()).optional() })
const EtherscanSource = z.object({ sources: Sources, settings: Settings })

export function sourceToEntries(
  name: string,
  source: string,
): [string, string][] {
  if (!source.startsWith('{')) {
    return [[`${name}.sol`, source]]
  }

  // etherscan sometimes wraps the json in {} so you get {{...}}
  if (source.startsWith('{{')) {
    source = source.slice(1, -1)
  }

  const parsed: unknown = JSON.parse(source)
  let validated: Record<string, { content: string }>
  try {
    const verified = EtherscanSource.parse(parsed)
    validated = verified.sources
  } catch {
    validated = Sources.parse(parsed)
  }

  return Object.entries(validated).map(([name, { content }]) => [name, content])
}
