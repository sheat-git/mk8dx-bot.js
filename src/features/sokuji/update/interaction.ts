import { InteractionHandler } from '@/interaction'
import { LatestTrackService, TrackService } from '@/services'
import { Sokuji, createTextError, sokujiLock } from '@/utilities'
import {
    ButtonStyle,
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
        for (let i = 0; i < 5; i++) {
            const field = interaction.fields.fields.get(`ranks_${i}`)
            if (!field) break
            ranks.push(field.value || null)
        }
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

InteractionHandler.button.register({
    commands: ['sokuji', 'edit'],
    handle: async (interaction, [type, option]) => {
        const isJa = interaction.locale === 'ja'
        const components = [
            {
                customId: 'n',
                label: isJa ? 'レース番号' : 'Race Number',
                placeholder: isJa ? '省略した場合は最新のレースを編集' : 'Edit the latest race if omitted',
            },
        ]
        if (type === 'race' || type === 'track')
            components.push({
                customId: 'track',
                label: isJa ? 'コース' : 'Track',
                placeholder: isJa ? Track.All[0].abbrJa : Track.All[0].abbr,
            })
        if (type === 'race' || type === 'ranks') {
            const tags = option.split(' ')
            const format = 12 / tags.length
            if (format !== 2)
                components.push(
                    ...tags.map((tag, i) => ({
                        customId: `ranks_${i}`,
                        label: tag,
                        placeholder: [...Array(format)].map((_, j) => i * format + j + 1).join(''),
                    })),
                )
        }
        await interaction.showModal({
            customId: `${interaction.customId}_${interaction.message.id}`,
            title: isJa ? '編集' : 'Edit',
            components: components.map((component) => ({
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
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['sokuji', 'edit'],
    handle: async (interaction, [type, tags]) => {
        const n = parseInt(
            interaction.fields
                .getTextInputValue('n')
                .replace(/[ー０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)),
        )
        if (interaction.fields.fields.size === 1) {
            const isJa = interaction.locale === 'ja'
            await interaction.reply({
                ephemeral: true,
                content: isJa
                    ? (Number.isNaN(n) ? '最新のレースを編集します。' : `${n}レース目を編集します。`) +
                      '続けて順位を入力してください。'
                    : (Number.isNaN(n) ? 'Edit the latest race.' : `Edit race ${n}.`) + ' Continue to enter the ranks.',
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                customId: `sokuji_2_edit_ranks_${n}_${tags}`,
                                label: isJa ? '入力' : 'Enter',
                                style: ButtonStyle.Success,
                            },
                        ],
                    },
                ],
            })
            return
        }
        await interaction.deferReply()
        await sokujiLock.acquire(interaction.channelId!, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId!, true)
            let i = -1
            if (Number.isInteger(n)) {
                if (n >= 0) i = n - 1
                else i = n
            }
            const race = sokuji.races.at(i)
            if (!race)
                throw createTextError(
                    Number.isInteger(n) ? `Race ${n} does not exist.` : 'The target race does not exist.',
                    Number.isInteger(n) ? `${n}レース目は存在しません。` : '対象のレースが存在しません。',
                )
            const trackField = interaction.fields.fields.get('track')
            if (type === 'track' || trackField?.value)
                race.track = await TrackService.search({
                    nick: trackField!.value,
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                })
            const ranks: (string | null)[] = []
            for (let i = 0; i < 4; i++) {
                const field = interaction.fields.fields.get(`ranks_${i}`)
                if (!field) break
                ranks.push(field.value || null)
            }
            let ranksEdited = false
            if (ranks.some((s) => s !== null)) {
                let scores = race.scores
                for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] -= scores[i]
                race.set(ranks, true)
                race.validateOrder()
                scores = race.scores
                for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] += scores[i]
                ranksEdited = true
            }
            await Promise.all([
                interaction.followUp({
                    content: sokuji.isJa
                        ? `${Number.isInteger(n) ? n : sokuji.races.length}レース目を編集しました。`
                        : `Edited race ${Number.isInteger(n) ? n : sokuji.races.length}.`,
                    embeds: sokuji.format !== 6 && ranksEdited ? [await sokuji.createRaceEmbed(i)] : [],
                }),
                sokuji.editPrevMessage(interaction.client, {
                    content: 'overwrite',
                    embeds: 'overwrite',
                    files: 'overwrite',
                }),
            ])
            await sokuji.saveWithPendingRace(true)
        })
    },
})

InteractionHandler.button.register({
    commands: ['sokuji', '2', 'edit', 'ranks'],
    handle: async (interaction, [n, tags]) => {
        const isJa = interaction.locale === 'ja'
        await interaction.showModal({
            customId: `sokuji_2_edit_ranks_${n}_${interaction.message.id}`,
            title: isJa ? '編集' : 'Edit',
            components: tags
                .split(' ')
                .slice(0, 5)
                .map((tag, i) => ({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            customId: `ranks_${i}`,
                            label: tag,
                            type: ComponentType.TextInput,
                            style: TextInputStyle.Short,
                            required: false,
                            placeholder: `${2 * i + 1}${2 * i + 2}`,
                        },
                    ],
                })),
        })
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['sokuji', '2', 'edit', 'ranks'],
    handle: async (interaction, [option]) => {
        await interaction.deleteReply()
        await sokujiLock.acquire(interaction.channelId!, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId!, true)
            const n = parseInt(option)
            let i = -1
            if (Number.isInteger(n)) {
                if (n >= 0) i = n - 1
                else i = n
            }
            const race = sokuji.races.at(i)
            if (!race)
                throw createTextError(
                    Number.isInteger(n) ? `Race ${n} does not exist.` : 'The target race does not exist.',
                    Number.isInteger(n) ? `${n}レース目は存在しません。` : '対象のレースが存在しません。',
                )
            const ranks = [...Array(5)].map((_, i) => interaction.fields.getTextInputValue(`ranks_${i}`) || null)
            let scores = race.scores
            for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] -= scores[i]
            race.set(ranks, true)
            race.validateOrder()
            scores = race.scores
            for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] += scores[i]
            await Promise.all([
                interaction.followUp({
                    content: sokuji.isJa
                        ? `${Number.isInteger(n) ? n : sokuji.races.length}レース目を編集しました。`
                        : `Edited race ${Number.isInteger(n) ? n : sokuji.races.length}.`,
                    embeds: [await sokuji.createRaceEmbed(i)],
                }),
                sokuji.editPrevMessage(interaction.client, {
                    content: 'overwrite',
                    embeds: 'overwrite',
                    files: 'overwrite',
                }),
            ])
            await sokuji.saveWithPendingRace(true)
        })
    },
})

InteractionHandler.button.register({
    commands: ['sokuji', 'undo'],
    handle: async (interaction) => {
        const isJa = interaction.locale === 'ja'
        const confirm = await interaction.reply({
            ephemeral: true,
            content: isJa
                ? 'この操作は取り消せません。即時集計を1つ戻してもよろしいですか？'
                : 'This operation cannot be undone. Are you sure you want to undo the latest of this sokuji?',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            customId: '0',
                            label: isJa ? 'はい' : 'Yes',
                            style: ButtonStyle.Danger,
                        },
                    ],
                },
            ],
            fetchReply: true,
        })
        const res = await confirm
            .awaitMessageComponent({
                componentType: ComponentType.Button,
                time: 10000,
            })
            .catch(() => null)
        if (!res) {
            await interaction.editReply({ content: isJa ? 'タイムアウトしました。' : 'Timed out.', components: [] })
            return
        }
        await res.update({ components: [] })
        await sokujiLock.acquire(interaction.channelId, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId, true)
            if (sokuji.prevMessageId !== interaction.message.id)
                throw createTextError(
                    'This sokuji is not up to date. Please run it again.',
                    'この即時集計は最新のものではありません。再度実行してください。',
                )
            const lastEntry = sokuji.entries.at(-1)
            if (!lastEntry) throw createTextError('Sokuji is empty.', '即時集計が空です。')
            for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] -= lastEntry.scores[i]
            if ('n' in lastEntry) sokuji.races.pop()
            else
                sokuji.others[
                    Math.max(
                        ...Object.entries(sokuji.others)
                            .filter(([_, v]) => v.length)
                            .map(([k]) => Number(k)),
                    )
                ].pop()
            await Promise.all([
                res.followUp({ content: isJa ? '1つ戻しました。' : 'Undo the latest.' }),
                sokuji.editPrevMessage(interaction.client, {
                    content: 'overwrite',
                    embeds: 'overwrite',
                    files: 'overwrite',
                }),
            ])
            await sokuji.saveWithPendingRace(true)
        })
    },
})
