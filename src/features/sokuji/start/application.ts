import { SlashHandler } from '@/interaction'
import { SlashCommandSubcommandBuilder } from 'discord.js'
import { StartCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'sokuji',
    builder: new SlashCommandSubcommandBuilder()
        .setName('start')
        .setDescription('Start a new sokuji')
        .setDescriptionLocalization('ja', '即時集計を開始')
        .addStringOption((option) =>
            option
                .setName('tags')
                .setRequired(true)
                .setDescription('Tags separated by spaces')
                .setDescriptionLocalization('ja', 'タグを空白区切りで指定'),
        )
        .addIntegerOption((option) =>
            option
                .setName('format')
                .setDescription('Format')
                .setDescriptionLocalization('ja', '形式')
                .addChoices(
                    ...[6, 4, 3, 2].map((format) => ({
                        name: `${format}v${format}`,
                        value: format,
                    })),
                ),
        ),
    handle: (interaction) =>
        new StartCommand(interaction, {
            format: interaction.options.getInteger('format') ?? undefined,
            tags: interaction.options.getString('tags', true),
        }).run(),
})
