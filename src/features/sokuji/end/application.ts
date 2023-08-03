import { SlashHandler } from '@/interaction'
import { EndCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'sokuji',
    builder: (builder) =>
        builder.setName('end').setDescription('Ends the sokuji').setDescriptionLocalization('ja', '即時集計を終了'),
    handle: (interaction) => new EndCommand(interaction).run(),
})
