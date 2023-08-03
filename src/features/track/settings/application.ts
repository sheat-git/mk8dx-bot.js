import { SlashHandler } from '@/interaction'
import { SlashCommandSubcommandBuilder } from 'discord.js'
import { SettingsCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'track',
    builder: new SlashCommandSubcommandBuilder()
        .setName('settings')
        .setDescription('Track Settings')
        .addStringOption((option) =>
            option.setName('for').setDescription('Server or User').setChoices(
                {
                    name: 'Server',
                    value: 'guild',
                },
                {
                    name: 'User',
                    value: 'user',
                },
            ),
        ),
    handle: async (interaction) => {
        const option = interaction.options.getString('for')
        const isGuild = option ? option === 'guild' : interaction.inGuild()
        await new SettingsCommand(interaction, { isGuild }).run()
    },
})
