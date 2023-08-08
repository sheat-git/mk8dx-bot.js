import { MessageHandler } from '@/message'
import { OtherCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['repick', 're'],
    handle: (message, _, arg) =>
        new OtherCommand(message, {
            reason: 'Repick',
            tag: arg,
            score: -15,
        }).run(),
})
