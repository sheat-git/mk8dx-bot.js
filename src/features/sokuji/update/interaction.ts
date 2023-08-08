import { InteractionHandler } from '@/interaction'
import { LatestTrackService, TrackService } from '@/services'
import { Sokuji, createTextError, sokujiLock } from '@/utilities'
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
    options.sokuji.editPrevMessage(options.interaction.client, { components: 'overwrite' }).catch(() => {})
    throw createTextError(
        'Some error has occurred. Please try again with the latest sokuji displayed by running `/sokuji now`.',
        '何らかのエラーが発生しました。`/sokuji now`を実行して表示された最新の即時集計に再度お試しください。',
    )
}

InteractionHandler.button.register({
    commands: ['sokuji', 'add'],
    handle: async (interaction, [option]) => {
        const tags = option.split(' ')
        const format = 12 / tags.length
        const customId = `sokuji_add_${interaction.message.id}`
        const isJa = interaction.locale === 'ja'
        switch (format) {
            case 6:
                await interaction.showModal({
                    customId,
                    title: isJa ? '順位とコースを追加' : 'Add Ranks and Track',
                    components: [
                        {
                            customId: 'ranks_0',
                            label: tags[0],
                            placeholder: '123456',
                            required: true,
                        },
                        {
                            customId: 'track',
                            label: isJa ? 'コース' : 'Track',
                            placeholder: isJa ? Track.All[0].abbrJa : Track.All[0].abbr,
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
                    components: tags.slice(0, 5).map((tag, i) => ({
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
                        ...tags.map((tag, i) => ({
                            customId: `ranks_${i}`,
                            label: tag,
                            placeholder: [...Array(format)].map((_, j) => i * format + j + 1).join(''),
                        })),
                        {
                            customId: 'track',
                            label: isJa ? 'コース' : 'Track',
                            placeholder: isJa ? Track.All[0].abbrJa : Track.All[0].abbr,
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

InteractionHandler.modalSubmit.register({
    commands: ['sokuji', 'add'],
    handle: async (interaction) => {
        await interaction.deferReply()
        const ranks: (string | null)[] = []
        const nullIndexes = []
        for (let i = 0; i < 5; i++) {
            const field = interaction.fields.fields.get(`ranks_${i}`)
            if (!field) break
            if (field.value) {
                ranks.push(field.value)
            } else {
                nullIndexes.push(i)
                ranks.push(null)
            }
        }
        if (nullIndexes.length === 1) ranks[nullIndexes[0]] = ''
        await sokujiLock.acquire(interaction.channelId!, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId!, true)
            checkSokuji({ sokuji, interaction })
            const isPending = sokuji.pendingRace !== null
            const race = isPending ? sokuji.pendingRace! : await sokuji.startNextRace(false)
            const track = interaction.fields.fields.get('track')?.value
            if (track)
                race.track = await TrackService.search({
                    nick: track,
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                })
            else if (!isPending)
                race.track = await LatestTrackService.default.get(
                    interaction.channelId!,
                    SnowflakeUtil.timestampFrom(sokuji.prevMessageId),
                )
            if (race.set(ranks, isPending)) {
                sokuji.pushPendingRace()
                const [_, newMessage] = await Promise.all([
                    sokuji.format !== 6 ? interaction.followUp(await sokuji.createRaceMessage(-1)) : null,
                    interaction.followUp(await sokuji.createMessage()),
                    sokuji.deletePendingRaceMessage(interaction.client),
                    sokuji.deletePrevMessage(interaction.client),
                ])
                await sokuji.save(newMessage.id)
            } else {
                const [newMessage] = await Promise.all([
                    interaction.followUp(await sokuji.createRaceMessage(true)),
                    sokuji.deletePendingRaceMessage(interaction.client),
                ])
                await sokuji.saveWithPendingRace(newMessage.id)
            }
        })
    },
})
