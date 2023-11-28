import { z } from 'zod'

export function parseContractSource(source: string): SolcInput {
  if (source.startsWith('{{') && source.endsWith('}}')) {
    source = source.slice(1, -1)
  }
  return SolcInput.parse(JSON.parse(source))
}

export type SolcInput = z.infer<typeof SolcInput>
export const SolcInput = z.object({
  language: z.string(),
  sources: z.record(
    z.object({
      keccak256: z.string().optional(),
      urls: z.array(z.string()).optional(),
      ast: z.unknown().optional(),
      content: z.string().optional(),
    }),
  ),
  settings: z
    .object({
      stopAfter: z.string().optional(),
      remappings: z.array(z.string()).optional(),
      optimizer: z
        .object({
          enabled: z.boolean().optional(),
          runs: z.number().optional(),
          details: z
            .object({
              peephole: z.boolean().optional(),
              inliner: z.boolean().optional(),
              jumpdestRemover: z.boolean().optional(),
              orderLiterals: z.boolean().optional(),
              deduplicate: z.boolean().optional(),
              cse: z.boolean().optional(),
              constantOptimizer: z.boolean().optional(),
              simpleCounterForLoopUncheckedIncrement: z.boolean().optional(),
              yul: z.boolean().optional(),
              yulDetails: z
                .object({
                  stackAllocation: z.boolean().optional(),
                  optimizerSteps: z.string().optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
      evmVersion: z.string().optional(),
      viaIR: z.boolean().optional(),
      debug: z
        .object({
          revertStrings: z.string().optional(),
          debugInfo: z.array(z.string()).optional(),
        })
        .optional(),
      metadata: z
        .object({
          appendCBOR: z.boolean().optional(),
          useLiteralContent: z.boolean().optional(),
          bytecodeHash: z.string().optional(),
        })
        .optional(),
      libraries: z.record(z.record(z.string())).optional(),
      outputSelection: z.record(z.record(z.array(z.string()))).optional(),
      modelChecker: z
        .object({
          contracts: z.record(z.array(z.string())).optional(),
          divModNoSlacks: z.boolean().optional(),
          engine: z.string().optional(),
          extCalls: z.string().optional(),
          invariants: z.array(z.string()).optional(),
          showProved: z.boolean().optional(),
          showUnproved: z.boolean().optional(),
          showUnsupported: z.boolean().optional(),
          solvers: z.array(z.string()).optional(),
          targets: z.array(z.string()).optional(),
          timeout: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
})
