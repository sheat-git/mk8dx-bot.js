import { Track, searchTrack } from 'mk8dx'
import { DetaService } from './deta'

export type TrackItem = {
    ignores: string[]
    additionals: Record<string, number>
}

export class TrackService {
    private readonly deta: DetaService<TrackItem>

    private constructor(baseName: string) {
        this.deta = new DetaService(baseName)
    }

    static readonly user = new TrackService('UserTrack')
    static readonly guild = new TrackService('GuildTrack')

    static async search(options: { nick: string; userId: string; guildId?: string }) {
        let trackId: number | undefined
        if (options.guildId) {
            const guild = await TrackService.guild.get(options.guildId)
            if (guild) {
                if (guild.ignores.includes(options.nick)) return null
                if (options.nick in guild.additionals) trackId = guild.additionals[options.nick]
            }
        }
        const user = await TrackService.user.get(options.userId)
        if (user) {
            if (user.ignores.includes(options.nick)) return null
            if (options.nick in user.additionals) trackId = user.additionals[options.nick]
        }
        return trackId !== undefined ? Track.All[trackId] : searchTrack(options.nick.trim())
    }

    async get(id: string) {
        return await this.deta.get(id)
    }

    async put(id: string, item: TrackItem) {
        await this.deta.put({
            key: id,
            ...item,
        })
    }
}

export type LatestTrackItem = {
    trackId: number
    date: number
}

export class LatestTrackService {
    private readonly deta = new DetaService<LatestTrackItem>('LatestTrack')

    static readonly default = new LatestTrackService()

    async get(channelId: string, from?: number) {
        const item = await this.deta.get(channelId)
        if (item && (!from || item.date > from)) return Track.All[item.trackId]
        return null
    }

    async put(channelId: string, trackId: number) {
        await this.deta.put({
            key: channelId,
            trackId,
            date: Date.now(),
        })
    }
}
