import { z } from 'zod'

export type SolidityStorageEntry = z.infer<typeof SolidityStorageEntry>
export const SolidityStorageEntry = z.strictObject({
  astId: z.number(),
  contract: z.string(),
  label: z.string(),
  offset: z.number(),
  slot: z.string(),
  type: z.string(),
})

export type SolidityTypeEntry = z.infer<typeof SolidityTypeEntry>
export const SolidityTypeEntry = z.strictObject({
  encoding: z.enum(['inplace', 'mapping', 'dynamic_array', 'bytes']),
  label: z.string(),
  numberOfBytes: z.string(),
  key: z.string().optional(),
  value: z.string().optional(),
  base: z.string().optional(),
  members: z.array(SolidityStorageEntry).optional(),
})

export type SolidityStorageLayout = z.infer<typeof SolidityStorageLayout>
export const SolidityStorageLayout = z.strictObject({
  storage: z.array(SolidityStorageEntry),
  types: z.record(SolidityTypeEntry).nullable(),
})
