import { ButtonStyle, ComponentType, Guild } from 'discord.js'
import { TrackService } from '@/services/track'
import { Command, MessageOptions, createTextError } from '@/utilities'
import { Track } from 'mk8dx'
import { ColoredEmbedBuilder } from '@/components/embed'
import { GuildService } from '@/services/guild'

export class SettingsCommand extends Command<{
    isGuild: boolean
}> {
    async run() {
        if (this.options.isGuild && !this.data.inGuild())
            throw createTextError(
                'Server settings can only be done on the server.',
                'サーバーの設定はサーバーでしか行えません。',
            )
        await this.defer(!this.options.isGuild)
        await this.reply(
            await createTrackSettingsMessage({
                guild: this.options.isGuild ? await this.data.client.guilds.fetch(this.data.guildId!) : undefined,
                id: this.options.isGuild ? this.data.guildId! : this.user.id,
                isJa: this.isJa,
            }),
        )
    }
}

export const createTrackSettingsMessage = async (options: {
    guild?: Guild
    id: string
    isJa: boolean
}): Promise<MessageOptions> => {
    const track = await TrackService[options.guild ? 'guild' : 'user'].get(options.id)
    const embed = new ColoredEmbedBuilder()
    const isJa = await (async () => {
        if (!options.guild) return options.isJa
        const guild = await GuildService.default.get(options.guild)
        embed.setColor(guild.color)
        return guild.isJa
    })()
    return {
        embeds: [
            embed.setTitle(`${options.guild ? 'Server' : 'User'} Track Settings`).addFields([
                {
                    name: isJa ? '辞書' : 'Dictionary',
                    value:
                        Object.entries(track?.additionals ?? {})
                            .map(([key, value]) => `- ${key}: ${Track.All[value].getAbbr(isJa ? 'ja' : undefined)}`)
                            .join('\n') || 'None',
                },
                {
                    name: isJa ? '無視リスト' : 'Ignores',
                    value: track?.ignores.map((e) => `- ${e}`).join('\n') || 'None',
                },
            ]),
        ],
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        label: isJa ? '辞書に追加' : 'Add to Dictionary',
                        customId: 'tracks_settings_dictionary_add',
                        style: ButtonStyle.Primary,
                    },
                    {
                        type: ComponentType.Button,
                        label: isJa ? '辞書から削除' : 'Remove from Dictionary',
                        customId: 'tracks_settings_dictionary_remove',
                        style: ButtonStyle.Danger,
                    },
                ],
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        label: isJa ? '無視リストに追加' : 'Add to Ignores',
                        customId: 'tracks_settings_ignores_add',
                        style: ButtonStyle.Primary,
                    },
                    {
                        type: ComponentType.Button,
                        label: isJa ? '無視リストから削除' : 'Remove from Ignores',
                        customId: 'tracks_settings_ignores_remove',
                        style: ButtonStyle.Danger,
                    },
                ],
            },
        ],
    }
}
