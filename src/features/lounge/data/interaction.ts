import { Message, StringSelectMenuComponent } from 'discord.js'
import { InteractionHandler } from '@/interaction'
import { DataType, createDataMessage, dataTypes } from './command'

const extractOptions = (message: Message) => {
    const fields = message.embeds[0].fields
    const players = (fields.at(-1)?.name === 'Avg.' ? fields.slice(0, -1) : fields).map((field) => {
        const playerId = field.value.match(/PlayerDetails\/(\d+)/)?.[1]
        return {
            name: field.name,
            id: playerId ? parseInt(playerId) : undefined,
        }
    })
    return {
        players,
        showSeason: message.components.length > 0,
        showType: message.components.length > 1,
    }
}

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'data', 'season'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createDataMessage({
                ...extractOptions(interaction.message),
                type: Object.entries(dataTypes).find(
                    (entry) => entry[1] === interaction.message.embeds[0].title,
                )![0] as DataType,
                season: parseInt(interaction.values[0]),
            }),
        )
    },
})

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'data', 'type'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await interaction.editReply(
            await createDataMessage({
                ...extractOptions(interaction.message),
                season: parseInt(
                    (interaction.message.components[0].components[0] as StringSelectMenuComponent).options.find(
                        (option) => option.default,
                    )!.value,
                ),
                type: interaction.values[0] as DataType,
            }),
        )
    },
})
