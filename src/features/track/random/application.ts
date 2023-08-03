import { SlashHandler } from '@/interaction'
import { RandomCommand } from './command'

SlashHandler.default.registerSub({
    parent: 'track',
    builder: (builder) => builder.setName('random').setDescription('Random Track'),
    handle: (interaction) => new RandomCommand(interaction).run(),
})
