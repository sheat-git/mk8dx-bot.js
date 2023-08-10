import { SlashHandler } from '@/interaction'
import { OtherCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'sokuji',
    builder: (builder) =>
        builder
            .setName('repick')
            .setDescription('Add repick')
            .setDescriptionLocalization('ja', 'リピックを追加')
            .addStringOption((option) => option.setName('tag').setDescription('Tag'))
            .addIntegerOption((option) => option.setName('score').setDescription('Score').setMaxValue(0)),
    handle: (interaction) =>
        new OtherCommand(interaction, {
            tag: interaction.options.getString('tag') ?? undefined,
            score: interaction.options.getInteger('score') ?? -15,
            reason: 'Repick',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'sokuji',
    builder: (builder) =>
        builder
            .setName('penalty')
            .setDescription('Add penalty')
            .setDescriptionLocalization('ja', 'ペナルティを追加')
            .addIntegerOption((option) =>
                option.setName('score').setDescription('Score').setMaxValue(0).setRequired(true),
            )
            .addStringOption((option) => option.setName('tag').setDescription('Tag')),
    handle: (interaction) =>
        new OtherCommand(interaction, {
            tag: interaction.options.getString('tag') ?? undefined,
            score: interaction.options.getInteger('score', true),
            reason: 'Penalty',
        }).run(),
})

SlashHandler.default.registerSub({
    parent: 'sokuji',
    builder: (builder) =>
        builder
            .setName('bonus')
            .setDescription('Add bonus')
            .setDescriptionLocalization('ja', 'ボーナスを追加')
            .addIntegerOption((option) =>
                option.setName('score').setDescription('Score').setMinValue(0).setRequired(true),
            )
            .addStringOption((option) => option.setName('tag').setDescription('Tag')),
    handle: (interaction) =>
        new OtherCommand(interaction, {
            tag: interaction.options.getString('tag') ?? undefined,
            score: interaction.options.getInteger('score', true),
            reason: 'Bonus',
        }).run(),
})
