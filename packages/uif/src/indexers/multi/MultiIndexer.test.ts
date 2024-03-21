import { Logger } from '@l2beat/backend-tools'
import { expect, mockFn } from 'earl'

import { IMultiIndexer, MultiIndexer } from './MultiIndexer'
import { Configuration, StoredConfiguration } from './types'

describe(MultiIndexer.name, () => {
  describe(MultiIndexer.prototype.update.name, () => {
    it('calls multiUpdate with an early matching configuration', async () => {
      const testIndexer = new TestMultiIndexer(
        [actual('a', 100, 200), actual('b', 300, 400)],
        [],
      )

      const newHeight = await testIndexer.update(100, 500)

      expect(newHeight).toEqual(200)
      expect(testIndexer.multiUpdate).toHaveBeenOnlyCalledWith(100, 200, [
        actual('a', 100, 200),
      ])
    })

    it('calls multiUpdate with a late matching configuration', async () => {
      const testIndexer = new TestMultiIndexer(
        [actual('a', 100, 200), actual('b', 300, 400)],
        [],
      )

      const newHeight = await testIndexer.update(300, 500)

      expect(newHeight).toEqual(400)
      expect(testIndexer.multiUpdate).toHaveBeenOnlyCalledWith(300, 400, [
        actual('b', 300, 400),
      ])
    })

    it('calls multiUpdate with a two matching configurations', async () => {
      const testIndexer = new TestMultiIndexer(
        [actual('a', 100, 200), actual('b', 100, 400)],
        [],
      )

      const newHeight = await testIndexer.update(100, 500)

      expect(newHeight).toEqual(200)
      expect(testIndexer.multiUpdate).toHaveBeenOnlyCalledWith(100, 200, [
        actual('a', 100, 200),
        actual('b', 100, 400),
      ])
    })

    it('calls multiUpdate with a two middle matching configurations', async () => {
      const testIndexer = new TestMultiIndexer(
        [actual('a', 100, 400), actual('b', 200, 500)],
        [],
      )

      const newHeight = await testIndexer.update(300, 600)

      expect(newHeight).toEqual(400)
      expect(testIndexer.multiUpdate).toHaveBeenOnlyCalledWith(300, 400, [
        actual('a', 100, 400),
        actual('b', 200, 500),
      ])
    })

    it('skips calling multiUpdate if we are too early', async () => {
      const testIndexer = new TestMultiIndexer(
        [actual('a', 100, 200), actual('b', 300, 400)],
        [],
      )

      const newHeight = await testIndexer.update(null, 500)

      expect(newHeight).toEqual(99)
      expect(testIndexer.multiUpdate).not.toHaveBeenCalled()
    })

    it('skips calling multiUpdate if we are too late', async () => {
      const testIndexer = new TestMultiIndexer(
        [actual('a', 100, 200), actual('b', 300, 400)],
        [],
      )

      const newHeight = await testIndexer.update(400, 500)

      expect(newHeight).toEqual(500)
      expect(testIndexer.multiUpdate).not.toHaveBeenCalled()
    })

    it('skips calling multiUpdate between configs', async () => {
      const testIndexer = new TestMultiIndexer(
        [actual('a', 100, 200), actual('b', 300, 400)],
        [],
      )

      const newHeight = await testIndexer.update(200, 500)

      expect(newHeight).toEqual(299)
      expect(testIndexer.multiUpdate).not.toHaveBeenCalled()
    })
  })
})

class TestMultiIndexer
  extends MultiIndexer<null>
  implements IMultiIndexer<null>
{
  constructor(
    configurations: Configuration<null>[],
    private readonly _stored: StoredConfiguration[],
  ) {
    super(Logger.SILENT, [], configurations)
  }

  override multiInitialize(): Promise<StoredConfiguration[]> {
    return Promise.resolve(this._stored)
  }

  multiUpdate = mockFn<MultiIndexer<null>['multiUpdate']>((_, targetHeight) =>
    Promise.resolve(targetHeight),
  )

  removeData = mockFn<MultiIndexer<null>['removeData']>()

  setStoredConfigurations =
    mockFn<MultiIndexer<null>['setStoredConfigurations']>()
}

function actual(id: string, minHeight: number, maxHeight: number | null) {
  return { id, properties: null, minHeight, maxHeight }
}
