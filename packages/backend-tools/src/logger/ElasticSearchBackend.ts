import { Client } from '@elastic/elasticsearch'
import { v4 as uuidv4 } from 'uuid';

import { LoggerBackend } from './interfaces';

export interface ElasticSearchBackendOptions {
	node: string
	apiKey: string
	flushInterval?: number
	indexPrefix?: string
}

export class ElasticSearchBackend implements LoggerBackend {

	private readonly options: Required<ElasticSearchBackendOptions>
	private readonly buffer: string[]
	private readonly client: Client;

	constructor(options: ElasticSearchBackendOptions) {
		this.options = {
			...options,
			flushInterval: options.flushInterval ?? 10000,
			indexPrefix: options.indexPrefix ?? 'logs'
		}

		this.client = new Client({
			node: options.node,
			auth: {
				apiKey: options.apiKey
			}
		});

		this.buffer = []
		this.start()
	}

	public debug(message: string): void {
		this.buffer.push(message);
	}

	public log(message: string): void {
		this.buffer.push(message);
	}

	public warn(message: string): void {
		this.buffer.push(message);
	}

	public error(message: string): void {
		this.buffer.push(message);
	}

	private start(): void {
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		setInterval(async () => {
			await this.flushLogs()
		}, this.options.flushInterval)
	}

	private async flushLogs(): Promise<void> {
		try {
			const index = await this.createIndex();

			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			const documents = this.buffer.map((message) => ({
				id: uuidv4(),
				...JSON.parse(message)
			}))

			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			const operations = documents.flatMap(doc => [{ index: { _index: index } }, doc])

			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			const bulkResponse = await this.client.bulk({ refresh: true, operations })

			if (bulkResponse.errors) {
				throw new Error('Failed to push liogs to Elastic Search node')
			}

		} catch (error) {
			console.log(error);
		}
	}

	private async createIndex(): Promise<string> {
		const now = new Date();
		const indexName = `${this.options.indexPrefix}-${now.getFullYear()}.${now.getMonth()}.${now.getDay()}`

		const exist = await this.client.indices.exists({ index: indexName })
		if (!exist) {
			await this.client.indices.create({
				index: indexName
			})
		}
		return indexName
	}
}
