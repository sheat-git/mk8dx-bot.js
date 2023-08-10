import { MessageHandler } from '@/message'
import { OtherCommand } from './command'
import { createTextError } from '@/utilities'

MessageHandler.withPrefix.register({
    commands: ['repick', 're'],
    handle: (message, _, arg) =>
        new OtherCommand(message, {
            reason: 'Repick',
            tag: arg,
            score: -15,
        }).run(),
})

MessageHandler.withPrefix.register({
    commands: ['penalty', 'pen', 'pe'],
    handle: async (message, _, arg) => {
        const args = arg.split(/\s+/, 2)
        const score = parseInt(args[0])
        if (Number.isNaN(score))
            throw createTextError(
                'The argument is incorrect.\nExample: `%penalty 10`',
                '引数に誤りがあります。\n例: `%penalty 10`',
            )
        await new OtherCommand(message, {
            reason: 'Penalty',
            tag: args.at(1),
            score: -Math.abs(score),
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['bonus', 'bon', 'bo'],
    handle: async (message, _, arg) => {
        const args = arg.split(/\s+/, 2)
        const score = parseInt(args[0])
        if (Number.isNaN(score))
            throw createTextError(
                'The argument is incorrect.\nExample: `%bonus 10`',
                '引数に誤りがあります。\n例: `%bonus 10`',
            )
        await new OtherCommand(message, {
            reason: 'Bonus',
            tag: args.at(1),
            score: Math.abs(score),
        }).run()
    },
})
