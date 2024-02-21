import { z } from 'zod'

export type ReviewMeta = z.infer<typeof ReviewMeta>
export const ReviewMeta = z.object({
  description: z.string().default('UNKNOWN'),
  severity: z.string().default('UNKNOWN'),
  type: z.string().default('UNKNOWN'),
})

export type ContractMeta = z.infer<typeof ContractMeta>
export const ContractMeta = z.object({
  name: z.string(),
  description: z.string().optional(),
  values: z.record(z.string(), ReviewMeta),
})

export type DiscoveryMeta = z.infer<typeof DiscoveryMeta>
export const DiscoveryMeta = z.object({
  ['$schema']: z.string().optional(),
  metas: z.array(ContractMeta),
})
