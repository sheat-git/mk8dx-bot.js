import { MessageHandler } from '@/message'
import { FcCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['fc'],
    handle: (message, _, arg) => new FcCommand(message, { players: arg }).run(),
})
