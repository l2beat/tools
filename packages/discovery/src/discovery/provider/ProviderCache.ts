import sqlite3 from 'sqlite3' // SQLite Client

import { ChainId } from '../../utils/ChainId'

const DATABASE_URL = './cache/discovery.sqlite'

interface DBClient {
  query: (query: string, values?: unknown[]) => Promise<unknown>
}

export class ProviderCache {
  private readonly client: DBClient
  private isInitialized = false

  constructor(private readonly chainId: ChainId) {
    const db = new sqlite3.Database(DATABASE_URL)
    this.client = {
      query: (query: string, values?: unknown[]) =>
        new Promise((resolve, reject) => {
          db.all(query, values, (err, rows) => {
            if (err) reject(err)
            resolve(rows)
          })
        }),
    }
  }

  async init(): Promise<void> {
    // Initialize cache table
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value STRING
      )
    `)
    this.isInitialized = true
  }

  async get(filename: string, key: string): Promise<string | undefined> {
    const _key = `${this.chainId.toString()}.${filename}.${key}`
    if (!this.isInitialized) throw new Error('ProviderCache not initialized')
    try {
      const result = (await this.client.query(
        'SELECT value FROM cache WHERE key=$1',
        [_key],
      )) as { value: string }[]
      if (result.length > 0) {
        return result[0]?.value
      }
      return undefined
    } catch (error) {
      console.error('Error reading from cache', error)
    }
  }

  async set(filename: string, key: string, value: string): Promise<void> {
    const _key = `${this.chainId.toString()}.${filename}.${key}`
    if (!this.isInitialized) throw new Error('ProviderCache not initialized')
    try {
      await this.client.query(
        'INSERT INTO cache(key, value) VALUES($1, $2) ON CONFLICT(key) DO UPDATE SET value=$2',
        [_key, value],
      )
    } catch (error) {
      console.error('Error writing to cache', error)
    }
  }
}
