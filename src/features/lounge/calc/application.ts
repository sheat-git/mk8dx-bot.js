import { SlashHandler } from '@/interaction'
import { CalcCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'lounge',
    builder: (builder) =>
        builder
            .setName('calc')
            .setDescription('Calculate the mmr changes')
            .setDescriptionLocalization('ja', 'MMRの変化量を計算')
            .addStringOption((option) =>
                option
                    .setName('arg')
                    .setDescription('The mogi room text or table ID')
                    .setDescriptionLocalization('ja', '模擬部屋のテキストまたはテーブルID'),
            ),
    handle: (interaction) =>
        new CalcCommand(interaction, {
            arg: interaction.options.getString('arg') ?? undefined,
        }).run(),
})
