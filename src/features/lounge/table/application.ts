import { SlashCommandSubcommandBuilder } from 'discord.js'
import { SlashHandler } from '@/interaction'
import { TableCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: new SlashCommandSubcommandBuilder()
        .setName('table')
        .setDescription('The details of the table')
        .setDescriptionLocalization('ja', 'テーブルの詳細')
        .addNumberOption((option) => option.setRequired(true).setName('id').setDescription('ID')),
    handle: (interaction) =>
        new TableCommand(interaction, {
            tableId: interaction.options.getNumber('id', true),
        }).run(),
})
