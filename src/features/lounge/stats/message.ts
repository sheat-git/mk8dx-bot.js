import { createTextError } from '@/utilities'
import { MessageHandler } from '@/message'
import { StatsCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['stats'],
    isCommand: (command) => /^stats\d+$/.test(command),
    handle: async (message, command, arg) => {
        const season = parseInt(command.slice(5))
        await new StatsCommand(message, {
            season: Number.isNaN(season) ? undefined : season,
            name: arg,
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['ts', 'tierStats', 'tiersStats'],
    isCommand: (command) => /^(ts|tiers?stats)\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^(\S+)\s*(.*)$/)
        if (!match)
            throw createTextError(
                'The argument is incorrect.\nExample: `%ts sq`',
                '引数に誤りがあります。\n例: `%ts sq`',
            )
        const season = command.match(/\d*$/)?.[0]
        await new StatsCommand(message, {
            season: season ? parseInt(season) : undefined,
            name: match[2],
            tiers: match[1],
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['fs', 'formatStats', 'formatsStats'],
    isCommand: (command) => /^(fs|formats?stats)\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^([\d,]+)\s*(.*)$/)
        if (!match)
            throw createTextError('The argument is incorrect.\nExample: `%fs 2`', '引数に誤りがあります。\n例: `%fs 2`')
        const season = command.match(/\d*$/)?.[0]
        await new StatsCommand(message, {
            season: season ? parseInt(season) : undefined,
            name: match[2],
            formats: match[1],
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['first'],
    isCommand: (command) => /^first\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^(-?\d+)\s*(.*)$/)
        if (!match)
            throw createTextError(
                'The argument is incorrect.\nExample: `%first 10`',
                '引数に誤りがあります。\n例: `%first 10`',
            )
        const season = parseInt(command.slice(5))
        await new StatsCommand(message, {
            season: Number.isNaN(season) ? undefined : season,
            name: match[2],
            slice: { type: 'first', data: parseInt(match[1]) },
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['mid'],
    isCommand: (command) => /^mid\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^(-?\d+)-(-?\d+)\s*(.*)$/)
        if (!match)
            throw createTextError(
                'The argument is incorrect.\nExample: `%mid 10-20`',
                '引数に誤りがあります。\n例: `%mid 10-20`',
            )
        const season = parseInt(command.slice(3))
        await new StatsCommand(message, {
            season: Number.isNaN(season) ? undefined : season,
            name: match[3],
            slice: { type: 'mid', data: [parseInt(match[1]), parseInt(match[2])] },
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['last'],
    isCommand: (command) => /^last\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^(-?\d+)\s*(.*)$/)
        if (!match)
            throw createTextError(
                'The argument is incorrect.\nExample: `%last 10`',
                '引数に誤りがあります。\n例: `%last 10`',
            )
        const season = parseInt(command.slice(4))
        await new StatsCommand(message, {
            season: Number.isNaN(season) ? undefined : season,
            name: match[2],
            slice: { type: 'last', data: parseInt(match[1]) },
        }).run()
    },
})

MessageHandler.withPrefix.register({
    commands: ['slice'],
    isCommand: (command) => /^slice\d+$/.test(command),
    handle: async (message, command, arg) => {
        const match = arg.match(/^(-?\d*):(-?\d*)\s*(.*)$/)
        if (!match)
            throw createTextError(
                'The argument is incorrect.\nExample: `%slice -20:-10`',
                '引数に誤りがあります。\n例: `%slice -20:-10`',
            )
        const season = parseInt(command.slice(5))
        const [start, end] = match.slice(1).map(Number)
        await new StatsCommand(message, {
            season: Number.isNaN(season) ? undefined : season,
            name: match[3],
            slice: {
                type: 'slice',
                data: [Number.isNaN(start) ? undefined : start, Number.isNaN(end) ? undefined : end],
            },
        }).run()
    },
})
