import { LayoutItem } from './LayoutItem'
import { SlotView } from './SlotView'

export function flattenLayout(
  layout: LayoutItem[],
  slotOffset = 0,
  path: string[] = [],
): SlotView[] {
  const slots: SlotView[] = []
  for (let i = 0; i < layout.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const items: LayoutItem[] = [layout[i]!]
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    while (i < layout.length - 1 && layout[i]!.slot === layout[i + 1]!.slot) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      items.push(layout[i + 1]!)
      i++
    }
    const item = items[0]
    if (items.length === 1 && item) {
      if (item.kind === 'struct') {
        slots.push(
          ...flattenLayout(
            item.children,
            slotOffset + item.slot,
            path.concat(item.name),
          ),
        )
      } else if (item.kind === 'static array') {
        const items = Array.from({ length: item.length }).map(
          (_, i): LayoutItem => ({
            ...item.item,
            name: i.toString(),
            offset: 0,
            slot: i * Math.ceil(item.item.size / 32),
          }),
        )
        slots.push(
          ...flattenLayout(
            items,
            slotOffset + item.slot,
            path.concat(item.name),
          ),
        )
      } else if (item.kind === 'dynamic array') {
        slots.push({
          kind: 'dynamic array',
          path,
          slot: slotOffset + item.slot,
          variable: {
            name: item.name,
            aliases: [],
            offset: 0,
            size: 32,
            type: item.type,
          },
          itemView: flattenLayout(
            [{ ...item.item, name: '#', offset: 0, slot: 0 }],
            0,
            path.concat(item.name),
          ),
        })
      } else if (item.kind === 'mapping') {
        slots.push({
          kind: 'dynamic mapping',
          path,
          slot: slotOffset + item.slot,
          variable: {
            name: item.name,
            aliases: [],
            offset: 0,
            size: 32,
            type: item.type,
          },
          keyType: item.key.type,
          valueView: flattenLayout(
            [{ ...item.value, name: '*', offset: 0, slot: 0 }],
            0,
            path.concat(item.name),
          ),
        })
      } else {
        slots.push({
          kind:
            item.kind === 'dynamic bytes' ? 'dynamic bytes' : 'static single',
          path,
          slot: slotOffset + item.slot,
          variable: {
            name: item.name,
            aliases: [],
            offset: item.offset,
            size: item.size,
            type: item.type,
          },
        })
      }
    } else {
      slots.push({
        kind: 'static composite',
        path,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        slot: slotOffset + item!.slot,
        variables: items.map((item) => ({
          name: item.name,
          aliases: [],
          offset: item.offset,
          size: item.size,
          type: item.type,
        })),
      })
    }
  }
  return slots
}
