import { BaseIndexer } from '../BaseIndexer'

export abstract class ChildIndexer extends BaseIndexer {
  override async tick(): Promise<number> {
    return Promise.reject(new Error('ChildIndexer cannot tick'))
  }
}
