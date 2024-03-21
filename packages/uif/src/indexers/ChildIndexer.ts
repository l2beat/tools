import { BaseIndexer } from '../BaseIndexer'

/**
 * Because of the way TypeScript works, all child indexers need to
 * `extends ChildIndexer` and `implements IChildIndexer`. Otherwise it
 * is possible to have incorrect method signatures and TypeScript won't
 * catch it.
 */
export interface IChildIndexer {
  /**
   * Initializes the indexer. It should return a height that the indexer has
   * synced up to. If the indexer has not synced any data, it should return
   * `null`.
   *
   * This method is expected to read the height that was saved previously with
   * `setSafeHeight`. It shouldn't call `setSafeHeight` itself.
   */
  initialize: () => Promise<number | null>

  /**
   * Saves the height (most likely to a database). The height given is the
   * smallest height from all parents and what the indexer itself synced to
   * previously. It can be `null`.
   *
   * When `initialize` is called it is expected that it will read the same
   * height that was saved here.
   */
  setSafeHeight: (height: number | null) => Promise<void>

  /**
   * Implements the main data fetching process. It is up to the indexer to
   * decide how much data to fetch. For example given `.update(100, 200)`, the
   * indexer can only fetch data up to 110 and return 110. The next time this
   * method will be called with `.update(110, 200)`.
   *
   * @param currentHeight The height that the indexer has synced up to previously. Can
   * be `null` if no data was synced. This value is exclusive so the indexer
   * should not fetch data for this height.
   *
   * @param targetHeight The height that the indexer should sync up to. This value is
   * inclusive so the indexer should eventually fetch data for this height.
   *
   * @returns The height that the indexer has synced up to. Returning
   * `currentHeight` means that the indexer has not synced any data. Returning
   * a value greater than `currentHeight` means that the indexer has synced up
   * to that height. Returning a value less than `currentHeight` will trigger
   * invalidation down to the returned value. Returning `null` will invalidate
   * all data. Returning a value greater than `targetHeight` is not permitted.
   */
  update: (
    currentHeight: number | null,
    targetHeight: number,
  ) => Promise<number | null>

  /**
   * Responsible for invalidating data that was synced previously. It is
   * possible that no data was synced and this method is still called.
   *
   * Invalidation can, but doesn't have to remove data from the database. If
   * you only want to rely on the safe height, you can just return the target
   * height and the system will take care of the rest.
   *
   * This method doesn't have to invalidate all data. If you want to do it in
   * steps, you can return a height that is larger than the target height.
   *
   * @param targetHeight The height that the indexer should invalidate down to.
   * Can be `null`. If it is `null`, the indexer should invalidate all
   * data.
   *
   * @returns The height that the indexer has invalidated down to. Returning
   * `targetHeight` means that the indexer has invalidated all the required
   * data. Returning a value greater than `targetHeight` means that the indexer
   * has invalidated down to that height.
   */
  invalidate: (targetHeight: number | null) => Promise<number | null>
}

export abstract class ChildIndexer
  extends BaseIndexer
  implements IChildIndexer
{
  override async tick(): Promise<number> {
    return Promise.reject(new Error('ChildIndexer cannot tick'))
  }
}
