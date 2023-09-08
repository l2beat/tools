import fetch, { RequestInit, Response } from 'node-fetch'

export interface IHttpClient {
  fetch(url: string, init?: RequestInit): Promise<Response>
}

export class HttpClient implements IHttpClient {
  defaultTimeoutMs: number
  constructor(defaultTimeoutMs = 10_000) {
    this.defaultTimeoutMs = defaultTimeoutMs
  }

  fetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, {
      ...init,
      timeout: init?.timeout ?? this.defaultTimeoutMs,
    })
  }
}
