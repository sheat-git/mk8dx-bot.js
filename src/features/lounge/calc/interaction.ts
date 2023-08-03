import { StringSelectMenuComponent } from 'discord.js'
import { InteractionHandler } from '@/interaction'
import { createCalcMessage } from './command'

InteractionHandler.stringSelect.register({
    commands: ['lounge', 'calc', 'teams'],
    handle: async (interaction) => {
        const components = interaction.message.components[0].components[0] as StringSelectMenuComponent
        await interaction.update(
            createCalcMessage({
                index: parseInt(interaction.values[0]),
                teams: components.options.map((option) => ({
                    label: option.label,
                    mmr: parseInt(option.description!.slice(5)),
                })),
            }),
        )
    },
})
