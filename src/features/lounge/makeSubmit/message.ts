import { MessageHandler } from '@/message'
import { MakeSubmitCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['makeSubmit', 'makeTable', 'lt'],
    handle: (message, _, arg) => new MakeSubmitCommand(message, { arg }).run(),
})
