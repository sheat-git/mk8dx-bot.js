import { MessageHandler } from '@/message'
import { EndCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['end'],
    handle: (message) => new EndCommand(message).run(),
})
