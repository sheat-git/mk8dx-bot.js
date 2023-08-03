import { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js'
import { SlashHandler } from '@/interaction'
import { DataCommand, DataType, dataTypes } from './command'

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
const createBaseBuilderWithSeason = () =>
    createBaseBuilder().addNumberOption((option) => option.setName('season').setMinValue(4).setDescription('Season'))

const extractOptions = (interaction: ChatInputCommandInteraction) => ({
    players: interaction.options.getString('players') ?? undefined,
    fcs: interaction.options.getString('fcs') ?? undefined,
    room: interaction.options.getString('room') ?? undefined,
    role: interaction.options.getRole('role') ?? undefined,
})
const extractOptionsWithSeason = (interaction: ChatInputCommandInteraction) => ({
    ...extractOptions(interaction),
    season: interaction.options.getNumber('season') ?? undefined,
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason()
        .setName('data')
        .setDescription('Specific data')
        .setDescriptionLocalization('ja', '特定のデータ')
        .addStringOption((option) =>
            option
                .setName('type')
                .setDescription('Type')
                .setChoices(
                    ...Object.entries(dataTypes).map(([type, label]) => ({
                        name: label,
                        value: type,
                    })),
                ),
        ),
    handle: async (interaction) => {
        const type = interaction.options.getString('type') ?? 'mmr'
        await new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: type in dataTypes ? (type as DataType) : 'mmr',
            showSettings: true,
        }).run()
    },
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('links')
        .setDescription('Links of Lounge and MKC')
        .setDescriptionLocalization('ja', 'ラウンジとMKCのリンク'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptions(interaction),
            type: 'links',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason()
        .setName('mmr')
        .setDescription('MMR and Peak MMR')
        .setDescriptionLocalization('ja', 'MMRとPeak MMR'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: 'mmr',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason().setName('average-mmr').setDescription('Average MMR'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: 'averageMmr',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason()
        .setName('average-room')
        .setDescription('Total average MMR of the mogi rooms')
        .setDescriptionLocalization('ja', '模擬部屋の通算の平均MMR'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: 'averageRoomMmr',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason()
        .setName('base')
        .setDescription('Base MMR.')
        .setDescriptionLocalization('ja', '最初のMMR'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: 'baseMmr',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason().setName('rank').setDescription('Rank'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: 'overallRank',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason()
        .setName('events')
        .setDescription('Events played')
        .setDescriptionLocalization('ja', 'プレイしたイベント数'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: 'eventsPlayed',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilder()
        .setName('names')
        .setDescription('Name history')
        .setDescriptionLocalization('ja', '名前の変更歴'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptions(interaction),
            type: 'nameHistory',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: createBaseBuilderWithSeason().setName('strikes').setDescription('Strikes'),
    handle: (interaction) =>
        new DataCommand(interaction, {
            ...extractOptionsWithSeason(interaction),
            type: 'strikes',
        }).run(),
})
