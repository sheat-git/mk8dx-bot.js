import { InteractionHandler } from '@/interaction'
import { LatestTrackService } from '@/services/track'
import { Sokuji, createTextError } from '@/utilities'
import {
    ComponentType,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    SnowflakeUtil,
    TextInputStyle,
} from 'discord.js'
import { Track } from 'mk8dx'

const checkSokuji = async (options: {
    sokuji: Sokuji
    interaction: MessageComponentInteraction | ModalSubmitInteraction
}) => {
    if (options.sokuji.prevMessageId === options.interaction.message?.id) return
    await options.sokuji.editPrevMessage(options.interaction.client, { hideComponents: true })
    throw createTextError(
        'Some error has occurred. Please try again with the latest sokuji displayed by running `/sokuji now`.',
        '何らかのエラーが発生しました。`/sokuji now`を実行して表示された最新の即時集計に再度お試しください。',
    )
}

InteractionHandler.button.register({
    commands: ['sokuji', 'add'],
    handle: async (interaction) => {
        const [sokuji, track] = await Promise.all([
            Sokuji.loadNow(interaction.channelId, true),
            LatestTrackService.default.get(interaction.channelId, SnowflakeUtil.timestampFrom(interaction.message.id)),
        ])
        await checkSokuji({ sokuji, interaction })
        const customId = `sokuji_add_${interaction.message.id}`
        const isJa = interaction.locale === 'ja'
        switch (sokuji.format) {
            case 6:
                await interaction.showModal({
                    customId,
                    title: isJa ? '順位とコースを追加' : 'Add Ranks and Track',
                    components: [
                        {
                            customId: 'ranks_0',
                            label: sokuji.tags[0],
                            placeholder: '123456',
                            required: true,
                        },
                        {
                            customId: 'track',
                            label: isJa ? 'コース' : 'Track',
                            placeholder: isJa ? Track.All[0].abbrJa : Track.All[0].abbr,
                            value: (isJa ? track?.abbrJa : track?.abbr) ?? '',
                            required: false,
                        },
                    ].map((component) => ({
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                ...component,
                                type: ComponentType.TextInput,
                                style: TextInputStyle.Short,
                            },
                        ],
                    })),
                })
                break
            case 2:
                await interaction.showModal({
                    customId,
                    title: isJa ? '順位を追加' : 'Add Ranks',
                    components: sokuji.tags.slice(0, 5).map((tag, i) => ({
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.TextInput,
                                customId: `ranks_${i}`,
                                style: TextInputStyle.Short,
                                label: tag,
                                placeholder: `${2 * i + 1}${2 * i + 2}`,
                                required: true,
                            },
                        ],
                    })),
                })
                break
            default:
                await interaction.showModal({
                    customId,
                    title: isJa ? '順位とコースを追加' : 'Add Ranks and Track',
                    components: [
                        ...sokuji.tags.map((tag, i) => ({
                            customId: `ranks_${i}`,
                            label: tag,
                            placeholder: [...Array(sokuji.format)].map((_, j) => i * sokuji.format + j).join(''),
                        })),
                        {
                            customId: 'track',
                            label: isJa ? 'コース' : 'Track',
                            placeholder: isJa ? Track.All[0].abbrJa : Track.All[0].abbr,
                            value: (isJa ? track?.abbrJa : track?.abbr) ?? '',
                        },
                    ].map((component) => ({
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                ...component,
                                type: ComponentType.TextInput,
                                style: TextInputStyle.Short,
                                required: false,
                            },
                        ],
                    })),
                })
        }
    },
})
