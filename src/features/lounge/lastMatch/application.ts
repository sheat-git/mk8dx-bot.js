import { SlashCommandSubcommandBuilder } from 'discord.js'
import { SlashHandler } from '@/interaction'
import { LastMatchCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: new SlashCommandSubcommandBuilder()
        .setName('lastmatch')
        .setDescription('Last Match')
        .addStringOption((option) =>
            option
                .setName('name')
                .setDescription('Lounge name or mention')
                .setDescriptionLocalization('ja', 'ラウンジ名またはメンション'),
        )
        .addNumberOption((option) => option.setName('season').setMinValue(4).setDescription('Season'))
        .addNumberOption((option) =>
            option
                .setName('last')
                .setDescription('Number of matches from the latest')
                .setDescriptionLocalization('ja', '最新からのマッチ数'),
        )
        .addStringOption((option) =>
            option
                .setName('tiers')
                .setDescription('The tiers to limit (e.g. A,AB)')
                .setDescriptionLocalization('ja', 'Tierを制限（例: A,AB）'),
        )
        .addStringOption((option) =>
            option
                .setName('formats')
                .setDescription('The formats to limit (e.g. 3,4)')
                .setDescriptionLocalization('ja', '形式を制限（例: 3,4）'),
        )
        .addStringOption((option) =>
            option
                .setName('partners')
                .setDescription('The partners to limit (lounge names or mentions separated by comma)')
                .setDescriptionLocalization('ja', 'パートナーを制限（コンマ区切りで、ラウンジ名またはメンション）'),
        ),
    handle: async (interaction) => {
        const last = interaction.options.getNumber('last')
        await new LastMatchCommand(interaction, {
            name: interaction.options.getString('name') ?? undefined,
            season: interaction.options.getNumber('season') ?? undefined,
            last: last !== null ? last - 1 : undefined,
            tiers: interaction.options.getString('tiers') ?? undefined,
            formats: interaction.options.getString('formats') ?? undefined,
            partners: interaction.options.getString('partners') ?? undefined,
        }).run()
    },
})
