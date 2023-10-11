import { assert } from '@l2beat/backend-tools'
import { expect } from 'earl'
import { existsSync, unlinkSync } from 'fs'
import sqlite3 from 'sqlite3'

import { SQLiteCache } from './SQLiteCache'

describe('SQLiteCache', () => {
  it('inserts new cache entry ', () =>
    withTemporaryFile(async (sqlCache, rqe) => {
      const key = 'key'
      const value = 'value'
      const chainId = 1
      const blockNumber = 1

      await sqlCache.set(key, value, chainId, blockNumber)
      const queriedValue = await sqlCache.get(key)

      const resultRaw = await rqe.query<CacheEntry[]>(
        'SELECT * FROM cache WHERE key=$1',
        [key],
      )

      const [result] = resultRaw

      assert(result)

      // Interface
      expect(queriedValue).toEqual(value)

      // Raw
      expect(result.key).toEqual(key)
      expect(result.value).toEqual(value)
    }))

  it('replaces old value in case of conflict', () =>
    withTemporaryFile(async (sqlCache, rqe) => {
      const key = 'key'

      const value = 'value'
      const chainId = 1
      const blockNumber = 1

      const newValue = 'newValue'
      const newChainId = 2
      const newBlockNumber = 2

      await sqlCache.set(key, value, chainId, blockNumber)

      await sqlCache.set(key, newValue, newChainId, newBlockNumber)

      const resultRaw = await rqe.query<CacheEntry[]>(
        'SELECT * FROM cache WHERE key=$1',
        [key],
      )

      const [result] = resultRaw

      assert(result)

      expect(resultRaw.length).toEqual(1)
      expect(result.key).toEqual(key)
      expect(result.value).toEqual(newValue)
      expect(result.blockNumber).toEqual(newBlockNumber)
      expect(result.chainId).toEqual(newChainId)
    }))

  it('transforms undefined into null', () =>
    withTemporaryFile(async (sqlCache, rqe) => {
      const key = 'key'
      const value = 'value'
      const chainId = 1
      const blockNumber = undefined

      await sqlCache.set(key, value, chainId, blockNumber)

      const resultRaw = await rqe.query<CacheEntry[]>(
        'SELECT * FROM cache WHERE key=$1',
        [key],
      )

      const [result] = resultRaw

      assert(result)

      expect(result.blockNumber).toEqual(null!)
    }))
})

interface CacheEntry {
  key: string
  value: string
  chainId: number
  blockNumber: number
}

function randomSqlFile(): string {
  return `${Math.random().toString(36).substring(7)}.sqlite`
}

function destroyFile(file: string) {
  if (existsSync(file)) {
    unlinkSync(file)
  }
}

// Even if test fails miserably, it will still destroy the file despite the outcome
async function withTemporaryFile<T>(
  fn: (sqlCache: SQLiteCache, rawQueryExecutor: RawQueryExecutor) => Promise<T>,
): Promise<T> {
  const file = randomSqlFile()
  const sqlCache = new SQLiteCache(file)
  const rqe = rawQueryExecutor(file)
  await sqlCache.init()

  return fn(sqlCache, rqe).finally(() => destroyFile(file))
}

// Just for the sake of out-of-interface testing
type RawQueryExecutor = ReturnType<typeof rawQueryExecutor>

function rawQueryExecutor(url: string) {
  const db = new sqlite3.Database(url)

  const query = async <T>(query: string, params: any[] = []): Promise<T> =>
    new Promise((resolve, reject) => {
      db.all(query, params, (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve(result as T)
        }
      })
    })

  return { query }
}