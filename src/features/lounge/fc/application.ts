import { SlashHandler } from '@/interaction'
import { FcCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: (builder) =>
        builder
            .setName('fc')
            .setDescription('Switch friend code')
            .setDescriptionLocalization('ja', 'Switchのフレンドコード')
            .addStringOption((option) =>
                option
                    .setName('players')
                    .setDescription('Lounge names or mentions separated by comma')
                    .setDescriptionLocalization('ja', 'コンマ区切りで、ラウンジ名またはメンション'),
            )
            .addRoleOption((option) => option.setName('role').setDescription('Role')),
    handle: (interaction) =>
        new FcCommand(interaction, {
            players: interaction.options.getString('players') ?? undefined,
            role: interaction.options.getRole('role') ?? undefined,
        }).run(),
})
