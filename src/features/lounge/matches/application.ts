import { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js'
import { SlashHandler } from '@/interaction'
import { MacthesType, MatchesCommand, matchesTypes } from './command'

const createBaseBuilder = () =>
    new SlashCommandSubcommandBuilder()
        .addStringOption((option) =>
            option
                .setName('players')
                .setDescription('Lounge names or mentions separated by comma')
                .setDescriptionLocalization('ja', 'コンマ区切りで、ラウンジ名またはメンション'),
        )
        .addStringOption((option) =>
            option
                .setName('fcs')
                .setDescription('Text including friend codes')
                .setDescriptionLocalization('ja', 'フレンドコードを含むテキスト'),
        )
        .addStringOption((option) =>
            option
                .setName('room')
                .setDescription('Text of the mogi room')
                .setDescriptionLocalization('ja', '模擬部屋のテキスト'),
        )
        .addRoleOption((option) => option.setName('role').setDescription('Role'))
        .addStringOption((option) => option.setName('seasons').setDescription('Seasons'))

const extractOptions = (interaction: ChatInputCommandInteraction) => ({
    players: interaction.options.getString('players') ?? undefined,
    fcs: interaction.options.getString('fcs') ?? undefined,
    room: interaction.options.getString('room') ?? undefined,
    role: interaction.options.getRole('role') ?? undefined,
    seasons: interaction.options.getString('seasons') ?? undefined,
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('matches')
        .setDescription('Matches per tier, format or time')
        .setDescriptionLocalization('ja', 'Tier・形式や時間毎のマッチ数')
        .addStringOption((option) =>
            option
                .setName('type')
                .setDescription('Type')
                .setChoices(
                    ...Object.entries(matchesTypes).map(([type, label]) => ({
                        name: label,
                        value: type,
                    })),
                ),
        ),
    handle: async (interaction) => {
        const type = interaction.options.getString('type') ?? 'tier'
        await new MatchesCommand(interaction, {
            ...extractOptions(interaction),
            type: type in matchesTypes ? (type as MacthesType) : 'tier',
            showSettings: true,
        }).run()
    },
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('tiers')
        .setDescription('Matches per Tier')
        .setDescriptionLocalization('ja', 'Tier毎のマッチ数'),
    handle: (interaction) =>
        new MatchesCommand(interaction, {
            ...extractOptions(interaction),
            type: 'tier',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('formats')
        .setDescription('Matches per format')
        .setDescriptionLocalization('ja', '形式毎のマッチ数'),
    handle: (interaction) =>
        new MatchesCommand(interaction, {
            ...extractOptions(interaction),
            type: 'format',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('monthly')
        .setDescription('Matches per month')
        .setDescriptionLocalization('ja', '月毎のマッチ数'),
    handle: (interaction) =>
        new MatchesCommand(interaction, {
            ...extractOptions(interaction),
            type: 'monthly',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('weekly')
        .setDescription('Matches per week')
        .setDescriptionLocalization('ja', '週毎のマッチ数'),
    handle: (interaction) =>
        new MatchesCommand(interaction, {
            ...extractOptions(interaction),
            type: 'weekly',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('daily')
        .setDescription('Matches per day')
        .setDescriptionLocalization('ja', '日毎のマッチ数'),
    handle: (interaction) =>
        new MatchesCommand(interaction, {
            ...extractOptions(interaction),
            type: 'daily',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('hourly')
        .setDescription('Matches per hour')
        .setDescriptionLocalization('ja', '時間毎のマッチ数'),
    handle: (interaction) =>
        new MatchesCommand(interaction, {
            ...extractOptions(interaction),
            type: 'hourly',
        }).run(),
})
