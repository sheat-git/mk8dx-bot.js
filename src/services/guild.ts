import { Guild, Locale } from 'discord.js'
import { DetaService } from './deta'
import { LoungeService } from '.'
import Vibrant from 'node-vibrant'

const defaultColor = parseInt(process.env['DEFAULT_COLOR']!)

export type GuildItem = {
    color: number
    tag: string
    isJa: boolean
}

export class GuildService {
    private readonly deta = new DetaService<GuildItem>('Guild')

    static readonly default = new GuildService()

    async init(guild: Guild) {
        const [color, isJa] = await Promise.all([
            (async () => {
                try {
                    const iconUrl = guild.iconURL({ extension: 'png' })
                    if (!iconUrl) return null
                    const res = await fetch(iconUrl)
                    if (!res.ok) return null
                    const buffer = Buffer.from(await res.arrayBuffer())
                    const palette = await Vibrant.from(buffer).getPalette()
                    if (!palette.Vibrant) return null
                    return palette.Vibrant.rgb.reduce((a, b) => (a << 8) + b)
                } catch {
                    return null
                }
            })(),
            (async () => {
                try {
                    if (guild.preferredLocale === Locale.Japanese) return true
                    const player = await LoungeService.getPlayer({
                        discordId: guild.ownerId,
                    })
                    if (player.countryCode?.toLowerCase() === 'jp') return true
                    const owner = await guild.fetchOwner()
                    return /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(owner.nickname ?? '')
                } catch {
                    return null
                }
            })(),
        ])
        const item: GuildItem = {
            color: color ?? defaultColor,
            tag: guild.name.split(/\s/, 2)[0].slice(0, 10),
            isJa: isJa ?? false,
        }
        await this.deta.put({
            key: guild.id,
            ...item,
        })
        return item
    }

    async get(guild: Guild) {
        const item = await this.deta.get(guild.id)
        if (item) return item
        return await this.init(guild)
    }

    async getById(id: string) {
        return await this.deta.get(id)
    }
}
