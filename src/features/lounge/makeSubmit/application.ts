import { SlashCommandSubcommandBuilder } from 'discord.js'
import { SlashHandler } from '@/interaction'
import { MakeSubmitCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: new SlashCommandSubcommandBuilder()
        .setName('make-submit')
        .setDescription('A text for the !submit command')
        .setDescriptionLocalization('ja', '!submitコマンド用のテキスト')
        .addStringOption((option) =>
            option
                .setRequired(true)
                .setName('text')
                .setDescription('The text of mogi room.')
                .setDescriptionLocalization('ja', '模擬部屋のテキスト'),
        ),
    handle: (interaction) =>
        new MakeSubmitCommand(interaction, {
            arg: interaction.options.getString('text', true),
        }).run(),
})
