import { DetaService } from './deta'

export type SokujiConfigItem = {
    isJa: boolean
    showText: boolean
    showImage: boolean
    mode: 'classic' | 'compact'
}

export class SokujiConfigService {
    private readonly deta = new DetaService<SokujiConfigItem>('SokujiConfig')

    static readonly default = new SokujiConfigService()

    async get(channelId: string) {
        return await this.deta.get(channelId)
    }

    async put(channelId: string, item: SokujiConfigItem) {
        await this.deta.put({
            ...item,
            key: channelId,
        })
    }
}

export type SokujiEntity = {
    id: string
    guildId: string | null
    channelId: string
    configMessageId: string | null
    messageId: string
    format: number
    tags: string[]
    colors: number[]
    scores: number[]
    raceNum: number
    races: {
        trackId: number | null
        scores: number[]
        ranks: number[]
        order: number[]
    }[]
    pendingRace: {
        messageId: string
        trackId: number | null
        order: (number | null)[]
    } | null
    others: Record<
        number,
        {
            reason: string
            scores: number[]
        }[]
    >
    isEnded: boolean
}

type SokujiItem = Omit<SokujiEntity, 'id'>

export class SokujiService {
    private readonly deta = new DetaService<SokujiItem>('Sokuji')
    private readonly channelDeta = new DetaService<{
        sokujiId: string
    }>('SokujiChannelSokujiId')

    static readonly default = new SokujiService()

    async getById(id: string) {
        const item = await this.deta.get(id)
        if (!item) return null
        const { key, ...rest } = item
        return {
            id: key,
            ...rest,
        } as SokujiEntity
    }

    async getNow(channelId: string) {
        const { sokujiId } = (await this.channelDeta.get(channelId)) ?? {}
        if (!sokujiId) return null
        return await this.getById(sokujiId)
    }

    async put(entity: SokujiEntity, updateChannel = false) {
        const { id, ...item } = entity
        await Promise.all([
            this.deta.put({
                key: id,
                ...item,
            }),
            updateChannel
                ? this.channelDeta.put({
                      key: entity.channelId,
                      sokujiId: id,
                  })
                : Promise.resolve(),
        ])
    }
}

export class SokujiUserService {
    private readonly deta = new DetaService<{
        channelId: string
    }>('SokujiUserChannelId')

    static default = new SokujiUserService()

    async get(userId: string) {
        return await this.deta.get(userId)
    }

    async putChannelId(userId: string, channelId: string) {
        await this.deta.put({
            key: userId,
            channelId,
        })
    }
}
