/* eslint-disable @typescript-eslint/no-explicit-any */
import { Deta } from 'deta'
import Base from 'deta/dist/types/base'

const deta = Deta()

type WithKey<Item> = Item & { key: string }

type ExpireOption =
    | {
          expireIn?: number
      }
    | {
          expireAt?: Date | number
      }

export class DetaService<Item extends object> {
    private readonly base: Base

    constructor(baseName: string) {
        this.base = deta.Base(baseName)
    }

    async get(key: string) {
        return (await this.base.get(key)) as WithKey<Item> | null
    }

    async fetch(query?: any, options?: { limit?: number; last?: string }) {
        return (await this.base.fetch(query, options)) as {
            items: WithKey<Item>[]
            count: number
            last?: string
        }
    }

    async insert(item: WithKey<Item>, option?: ExpireOption) {
        return (await this.base.insert(item, item.key, option)) as WithKey<Item>
    }

    async update(item: WithKey<Partial<Item>>, option?: ExpireOption) {
        await this.base.update(item, item.key, option)
    }

    async put(item: WithKey<Item>, option?: ExpireOption) {
        return (await this.base.put(item, item.key, option)) as WithKey<Item> | null
    }

    async putMany(items: WithKey<Item>[], option?: ExpireOption) {
        return (await this.base.putMany(items, option)).processed.items as WithKey<Item>[]
    }

    async delete(key: string) {
        await this.base.delete(key)
    }
}
