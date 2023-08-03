import {
    ActionRowBuilder,
    ComponentType,
    Message,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import { Lounge } from 'mk8dx'
import { InteractionHandler } from '@/interaction'
import { createStatsMessage, SliceOption } from './command'

const extractOptions = (message: Message): Parameters<typeof createStatsMessage>[0] => {
    const findOptions = (message: Message, customIdEndsWith: string) => {
        const component = message.components.find(
            (component) => component.components[0].customId?.endsWith(customIdEndsWith),
        )?.components[0]
        if (!component || component.type !== ComponentType.StringSelect) return undefined
        return component.options
    }
    const findValues = (message: Message, customIdEndsWith: string) =>
        findOptions(message, customIdEndsWith)
            ?.filter((option) => option.default)
            ?.map((option) => option.value)
    const season = findValues(message, 'season')?.[0]
    const slice = findValues(message, 'slice')?.[0]
    return {
        playerId: parseInt(message.embeds[0].url!.split('/').pop()!),
        season: season ? parseInt(season) : undefined,
        slice: convertSlice(slice),
        tiers: findValues(message, 'tiers'),
        formats: findValues(message, 'formats')?.map(Number),
        partners: findOptions(message, 'partners')
            ?.filter((option) => option.value !== 'add')
            ?.map((option) => ({
                id: parseInt(option.value),
                name: option.label,
                isActive: option.default ?? false,
            })),
    }
}

const convertSlice = (slice: string | undefined): SliceOption | undefined => {
    if (!slice) return
    const [type, ...data] = slice.split('_')
    switch (type) {
        case 'all':
            return { type, data: undefined }
        case 'first':
        case 'last':
            return { type, data: parseInt(data[0]) }
        case 'mid':
        case 'slice':
            return {
                type,
                data: data.map((value) => (value ? parseInt(value) : undefined)) as [number?, number?],
            }
    }
}

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'stats', 'season'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createStatsMessage({
                ...extractOptions(interaction.message),
                season: parseInt(interaction.values[0]),
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'stats', 'slice'],
    handle: async (interaction) => {
        const value = interaction.values[0]
        const showModal = value !== 'all' && !value.includes('_')
        if (showModal) {
            const label = value.charAt(0).toUpperCase() + value.slice(1)
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId(`lounge_stats_slice_${value}`)
                    .setTitle(`Set ${label}`)
                    .setComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId('data')
                                .setRequired(true)
                                .setLabel(label)
                                .setPlaceholder(
                                    (() => {
                                        switch (value) {
                                            case 'first':
                                            case 'last':
                                                return '10'
                                            case 'mid':
                                                return '10-20'
                                            case 'slice':
                                                return '-20:-10'
                                            default:
                                                return ''
                                        }
                                    })(),
                                )
                                .setStyle(TextInputStyle.Short),
                        ),
                    ),
            )
        } else {
            await interaction.deferUpdate()
        }
        const options = extractOptions(interaction.message)
        if (!showModal) options.slice = convertSlice(value)
        const message = await createStatsMessage(options)
        if (showModal) await interaction.message.edit(message)
        else await interaction.editReply(message)
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['lounge', 'stats', 'slice'],
    handle: async (interaction, [type]) => {
        const text = interaction.fields.getTextInputValue('data')
        const slice: SliceOption | null = (() => {
            switch (type) {
                case 'first':
                case 'last':
                    const data = parseInt(text)
                    if (Number.isNaN(data)) return null
                    return { type, data }
                case 'mid': {
                    const match = text.match(/^(-?\d+)-(-?\d+)$/)
                    if (!match) return null
                    const [_, start, end] = match
                    return { type, data: [parseInt(start), parseInt(end)] }
                }
                case 'slice': {
                    const match = text.match(/^(-?\d*):(-?\d*)$/)
                    if (!match) return null
                    const [start, end] = match.slice(1).map(Number)
                    return {
                        type,
                        data: [Number.isNaN(start) ? undefined : start, Number.isNaN(end) ? undefined : end],
                    }
                }
                default:
                    return null
            }
        })()
        if (!slice) {
            await interaction.reply({
                content:
                    (interaction.locale === 'ja'
                        ? '入力された値が不正です。\n例: '
                        : 'The input value is invalid.\nExample: ') +
                    (() => {
                        switch (type) {
                            case 'first':
                            case 'last':
                                return '`10`'
                            case 'mid':
                                return '`10-20`'
                            case 'slice':
                                return '`-20:-10`'
                            default:
                                return ''
                        }
                    })(),
                ephemeral: true,
            })
        } else {
            await interaction.deferReply()
            await interaction.message!.edit(
                await createStatsMessage({
                    ...extractOptions(interaction.message!),
                    slice,
                }),
            )
            await interaction.deleteReply()
        }
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'stats', 'tiers'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createStatsMessage({
                ...extractOptions(interaction.message),
                tiers: interaction.values,
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'stats', 'formats'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createStatsMessage({
                ...extractOptions(interaction.message),
                formats: interaction.values.map(Number),
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'stats', 'partners'],
    handle: async (interaction) => {
        const showModal = interaction.values.includes('add')
        if (showModal) {
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId('lounge_stats_partners')
                    .setTitle('Add Partners')
                    .setComponents(
                        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                            new TextInputBuilder()
                                .setCustomId('partners')
                                .setRequired(true)
                                .setLabel('Partner Names')
                                .setPlaceholder(
                                    interaction.locale === 'ja'
                                        ? 'パートナーの名前を改行区切りで入力'
                                        : 'Enter partner names separated by line breaks',
                                )
                                .setStyle(TextInputStyle.Paragraph),
                        ),
                    ),
            )
        } else {
            await interaction.deferUpdate()
        }
        const options = extractOptions(interaction.message)
        const partnerIds = interaction.values.map((value) => parseInt(value))
        options.partners = options.partners?.map((partner) => ({
            ...partner,
            isActive: partnerIds.includes(partner.id),
        }))
        const message = await createStatsMessage(options)
        if (showModal) await interaction.message.edit(message)
        else await interaction.editReply(message)
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['lounge', 'stats', 'partners'],
    handle: async (interaction) => {
        await interaction.deferReply()
        const partnerNames = interaction.fields
            .getTextInputValue('partners')
            .split(/\n/)
            .flatMap((name) => name.split(/,/))
            .map((name) => name.trim())
            .filter((name) => name)
        const partners = await Promise.allSettled(partnerNames.map((name) => Lounge.getPlayer({ name })))
        const includeReject = partners.some((partner) => partner.status === 'rejected')
        if (includeReject) {
            const rejectedIndexes = partners
                .map((partner, index) => (partner.status === 'rejected' ? index : undefined))
                .filter((index) => index !== undefined) as number[]
            await interaction.followUp(
                interaction.locale === 'ja'
                    ? `次のパートナーが見つかりませんでした: ${rejectedIndexes
                          .map((index) => partnerNames[index])
                          .join(', ')}`
                    : `The following partners could not be found: ${rejectedIndexes
                          .map((index) => partnerNames[index])
                          .join(', ')}`,
            )
        }
        const fulFilledPartners = partners
            .filter((p): p is PromiseFulfilledResult<Lounge.Player> => p.status === 'fulfilled')
            .map((p) => p.value)
        const options = extractOptions(interaction.message!)
        options.partners = options.partners!.map((partner) => {
            const i = fulFilledPartners.findIndex((p) => p.id === partner.id)
            if (i !== -1) fulFilledPartners.splice(i, 1)
            return {
                ...partner,
                isActive: i === -1 ? partner.isActive : true,
            }
        })
        options.partners.push(
            ...fulFilledPartners.map((partner) => ({
                id: partner.id,
                name: partner.name,
                isActive: true,
            })),
        )
        await interaction.message!.edit(await createStatsMessage(options))
        if (!includeReject) await interaction.deleteReply()
    },
})

InteractionHandler.button.register({
    commands: ['lounge', 'stats', 'settings'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createStatsMessage({
                ...extractOptions(interaction.message),
                showAll: true,
            }),
        )
    },
})
