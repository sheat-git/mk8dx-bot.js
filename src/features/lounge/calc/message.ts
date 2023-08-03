import { MessageHandler } from '@/message'
import { CalcCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['calc'],
    handle: (message, _, arg) => new CalcCommand(message, { arg }).run(),
})
