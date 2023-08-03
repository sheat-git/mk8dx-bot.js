import { ContextMenuCommandBuilder, SlashCommandSubcommandBuilder } from 'discord.js'
import { ApplicationHandler, SlashHandler } from '@/interaction'
import { BotError } from '@/utilities'
import { SliceOption, StatsCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: new SlashCommandSubcommandBuilder()
        .setName('stats')
        .setDescription('Stats')
        .addStringOption((option) =>
            option
                .setName('name')
                .setDescription('Lounge name or mention')
                .setDescriptionLocalization('ja', 'ラウンジ名またはメンション'),
        )
        .addNumberOption((option) => option.setName('season').setMinValue(4).setDescription('Season'))
        .addNumberOption((option) =>
            option
                .setName('first')
                .setDescription('The first number of matches')
                .setDescriptionLocalization('ja', '最初のマッチ数'),
        )
        .addNumberOption((option) =>
            option
                .setName('last')
                .setDescription('The last number of matches')
                .setDescriptionLocalization('ja', '最新のマッチ数'),
        )
        .addStringOption((option) =>
            option
                .setName('mid')
                .setDescription('The middle number of matches (e.g. 10-20)')
                .setDescriptionLocalization('ja', '中間のマッチ（例: 10-20）'),
        )
        .addStringOption((option) =>
            option
                .setName('slice')
                .setDescription('The slice of matches (e.g. -20:-10)')
                .setDescriptionLocalization('ja', 'マッチをスライス（例: -20:-10）'),
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
        const slice: SliceOption | undefined = (() => {
            const first = interaction.options.getNumber('first')
            if (first !== null) return { type: 'first', data: first }
            const last = interaction.options.getNumber('last')
            if (last !== null) return { type: 'last', data: last }
            const mid = interaction.options.getString('mid')
            if (mid !== null) {
                const match = mid.trim().match(/^(-?\d+)-(-?\d+)$/)
                if (!match)
                    throw new BotError({
                        content:
                            interaction.locale === 'ja'
                                ? '`mid`の引数が間違っています。\n例: `10-20`'
                                : 'The `mid` argument is incorrect.\nExample: `10-20`',
                    })
                return { type: 'mid', data: [parseInt(match[1]), parseInt(match[2])] }
            }
            const slice = interaction.options.getString('slice')
            if (slice !== null) {
                const match = slice.trim().match(/^(-?\d*):(-?\d*)$/)
                if (!match)
                    throw new BotError({
                        content:
                            interaction.locale === 'ja'
                                ? '`slice`の引数が間違っています。\n例: `-20:-10`'
                                : 'The `slice` argument is incorrect.\nExample: `-20:-10`',
                    })
                const [start, end] = match.slice(1).map(Number)
                return {
                    type: 'slice',
                    data: [Number.isNaN(start) ? undefined : start, Number.isNaN(end) ? undefined : end],
                }
            }
        })()
        await new StatsCommand(interaction, {
            name: interaction.options.getString('name') ?? undefined,
            season: interaction.options.getNumber('season') ?? undefined,
            slice,
            tiers: interaction.options.getString('tiers') ?? undefined,
            formats: interaction.options.getString('formats') ?? undefined,
            partners: interaction.options.getString('partners') ?? undefined,
        }).run()
    },
})

ApplicationHandler.user.register({
    builder: new ContextMenuCommandBuilder()
        .setName('Show Lounge Stats')
        .setNameLocalization('ja', 'Lounge Statsを表示'),
    handle: (interaction) => new StatsCommand(interaction, {}).run(),
})
