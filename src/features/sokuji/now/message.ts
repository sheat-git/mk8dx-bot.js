import { MessageHandler } from '@/message'
import { NowCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['now'],
    handle: (message) => new NowCommand(message).run(),
})
