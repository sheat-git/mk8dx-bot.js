import { SlashHandler } from '@/interaction'
import { SlashCommandSubcommandBuilder } from 'discord.js'
import { NowCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'sokuji',
    builder: new SlashCommandSubcommandBuilder()
        .setName('now')
        .setDescription('Current sokuji')
        .setDescriptionLocalization('ja', '現在の即時集計'),
    handle: (interaction) => new NowCommand(interaction).run(),
})
