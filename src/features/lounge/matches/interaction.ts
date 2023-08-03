import { StringSelectMenuComponent, StringSelectMenuInteraction } from 'discord.js'
import { InteractionHandler } from '@/interaction'
import { MacthesType, createMatchesMessage, matchesTypes } from './command'
import { expectTimezone } from '@/utilities'

const extractOptions = (interaction: StringSelectMenuInteraction) => {
    const findComponent = (customId: string) =>
        interaction.message.components.find((component) => component.components[0].customId === customId)
            ?.components[0] as StringSelectMenuComponent | undefined
    const seasons = findComponent('lounge_matches_seasons')
        ?.options.filter((option) => option.default)
        .map((option) => parseInt(option.value))
    return {
        players: interaction.message.embeds[0].fields.map((field) => {
            const playerId = field.value.match(/PlayerDetails\/(\d+)/)?.[1]
            return {
                name: field.name,
                id: playerId ? parseInt(playerId) : undefined,
            }
        }),
        seasons,
        type: Object.entries(matchesTypes).find(
            ([_, label]) => label === interaction.message.embeds[0].title,
        )![0] as MacthesType,
        showSeasons: seasons !== undefined,
        showType:
            interaction.message.components.find(
                (component) => component.components[0].customId === 'lounge_matches_type',
            ) !== undefined,
        timezone:
            findComponent('lounge_matches_timezone')?.options.find((option) => option.default)?.value ??
            expectTimezone(interaction.locale),
    }
}

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'matches', 'seasons'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createMatchesMessage({
                ...extractOptions(interaction),
                seasons: interaction.values.map((value) => parseInt(value)),
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'matches', 'type'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createMatchesMessage({
                ...extractOptions(interaction),
                type: interaction.values[0] as MacthesType,
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'matches', 'timezone'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createMatchesMessage({
                ...extractOptions(interaction),
                timezone: interaction.values[0],
            }),
        )
    },
})
