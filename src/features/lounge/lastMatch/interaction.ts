import {
    ActionRowBuilder,
    ButtonComponent,
    ComponentType,
    Message,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import { InteractionHandler } from '@/interaction'
import { createLastMatchMessage } from './command'
import { Lounge } from 'mk8dx'

const extractOptions = (message: Message): Parameters<typeof createLastMatchMessage>[0] => {
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
    const centerLabels = (message.components[0].components[2] as ButtonComponent).label!.split('/').map(Number)
    const tableId = message.embeds[0].url?.match(/TableDetails\/(\d+)/)?.[1]
    const season = findValues(message, 'season')?.[0]
    return {
        playerId: parseInt(message.embeds[0].description!.match(/PlayerDetails\/(\d+)/)![1]),
        dif: centerLabels[1] - centerLabels[0],
        tableId: tableId ? parseInt(tableId) : undefined,
        season: season ? parseInt(season) : undefined,
        tiers: findValues(message, 'tiers'),
        formats: findValues(message, 'formats')?.map(Number),
        partners: findOptions(message, 'partners')
            ?.filter((option) => option.value !== 'add')
            ?.map((option) => ({
                id: parseInt(option.value),
                name: option.label,
                isActive: option.default ?? false,
            })),
        showEdit: true,
    }
}

InteractionHandler.button.register({
    commands: ['lounge', 'lastmatch', 'oldest'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createLastMatchMessage({
                ...extractOptions(interaction.message),
                dif: -1,
                tableId: undefined,
            }),
        )
    },
})

InteractionHandler.button.register({
    commands: ['lounge', 'lastmatch', 'prev'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        const options = extractOptions(interaction.message)
        await interaction.editReply(
            await createLastMatchMessage({
                ...options,
                dif: options.tableId !== undefined ? 1 : 0,
            }),
        )
    },
})

InteractionHandler.button.register({
    commands: ['lounge', 'lastmatch', 'next'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        const options = extractOptions(interaction.message)
        await interaction.editReply(
            await createLastMatchMessage({
                ...options,
                dif: options.tableId !== undefined ? -1 : 0,
            }),
        )
    },
})

InteractionHandler.button.register({
    commands: ['lounge', 'lastmatch', 'latest'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createLastMatchMessage({
                ...extractOptions(interaction.message),
                dif: 0,
                tableId: undefined,
            }),
        )
    },
})

InteractionHandler.button.register({
    commands: ['lounge', 'lastmatch', 'edit'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createLastMatchMessage({
                ...extractOptions(interaction.message),
                dif: 0,
                showAll: true,
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'lastmatch', 'season'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createLastMatchMessage({
                ...extractOptions(interaction.message),
                tableId: undefined,
                season: parseInt(interaction.values[0]),
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'lastmatch', 'tiers'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createLastMatchMessage({
                ...extractOptions(interaction.message),
                tableId: undefined,
                tiers: interaction.values,
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'lastmatch', 'formats'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createLastMatchMessage({
                ...extractOptions(interaction.message),
                tableId: undefined,
                formats: interaction.values.map(Number),
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'lastmatch', 'partners'],
    handle: async (interaction) => {
        const showModal = interaction.values.includes('add')
        if (showModal) {
            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId('lounge_lastmatch_partners')
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
        const options = {
            ...extractOptions(interaction.message),
            tableId: undefined,
        }
        const partnerIds = interaction.values.map((value) => parseInt(value))
        options.partners = options.partners?.map((partner) => ({
            ...partner,
            isActive: partnerIds.includes(partner.id),
        }))
        const message = await createLastMatchMessage(options)
        if (showModal) await interaction.message.edit(message)
        else await interaction.editReply(message)
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['lounge', 'lastmatch', 'partners'],
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
        const options = {
            ...extractOptions(interaction.message!),
            tableId: undefined,
        }
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
        await interaction.message!.edit(await createLastMatchMessage(options))
        if (!includeReject) await interaction.deleteReply()
    },
})
