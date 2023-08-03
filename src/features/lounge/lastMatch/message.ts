import { MessageHandler } from '@/message'
import { LastMatchCommand } from './command'
import { createTextError } from '@/utilities'

const extractArg = (arg: string) => {
    const match = arg.match(/^(\d+)\s*(.*)$/)
    if (!match) return { name: arg }
    return { last: parseInt(match[1]), name: match[2] }
}

MessageHandler.withPrefix.register({
    commands: ['lastMatch', 'lm'],
    isCommand: (command) => /^(lastmatch|lm)\d+$/.test(command),
    handle: async (message, command, arg) => {
        const season = command.match(/\d*$/)?.[0]
        const { last, name } = extractArg(arg)
        await new LastMatchCommand(message, {
            name,
            last: last !== undefined ? last - 1 : undefined,
            season: season ? parseInt(season) : undefined,
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['tlm', 'tierLastMatch', 'tiersLastMatch'],
    isCommand: (command) => /^(tlm|tiers?lastmatch)\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^(\S+)\s*(.*)$/)
        if (!match)
            throw createTextError(
                'The argument is incorrect.\nExample: `%tlm sq`',
                '引数に誤りがあります。\n例: `%tlm sq`',
            )
        const season = command.match(/\d*$/)?.[0]
        await new LastMatchCommand(message, {
            season: season ? parseInt(season) : undefined,
            name: match[2],
            tiers: match[1],
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['flm', 'formatLastMatch', 'formatsLastMatch'],
    isCommand: (command) => /^(flm|formats?lastmatch)\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^([\d,]+)\s*(.*)$/)
        if (!match)
            throw createTextError(
                'The argument is incorrect.\nExample: `%flm 2`',
                '引数に誤りがあります。\n例: `%flm 2`',
            )
        const season = command.match(/\d*$/)?.[0]
        await new LastMatchCommand(message, {
            season: season ? parseInt(season) : undefined,
            name: match[2],
            formats: match[1],
        }).run()
    },
})
