import { GuildService } from '@/services/guild'
import { EmbedBuilder, Guild } from 'discord.js'

const defaultColor = parseInt(process.env['DEFAULT_COLOR']!)

export class ColoredEmbedBuilder extends EmbedBuilder {
    constructor() {
        super()
        this.setColor(defaultColor)
    }
}

export const createColoredEmbed: {
    (guild?: Guild | null): Promise<EmbedBuilder>
    (guildId?: string | null): Promise<EmbedBuilder>
} = async (guild?: Guild | string | null) => {
    const embed = new ColoredEmbedBuilder()
    if (guild) {
        const g =
            typeof guild === 'string'
                ? await GuildService.default.getById(guild)
                : await GuildService.default.get(guild)
        if (g) embed.setColor(g.color)
    }
    return embed
}
