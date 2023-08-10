import { Message } from 'discord.js'
import { MessageHandler } from '@/message'
import { DataCommand } from './command'

const createDataCommandRunner =
    (config: DataCommand['options'], argType: 'players' | 'fcs' | 'room' = 'players') =>
    async (message: Message, command: string, arg: string) => {
        const options = { ...config }
        const season = command.match(/\d+/)?.[0]
        if (season) options.season = parseInt(season)
        options[argType] = arg
        await new DataCommand(message, options as DataCommand['options']).run()
    }

MessageHandler.withPrefix.register({
    commands: ['data'],
    isCommand: (command) => /^data\d+$/.test(command),
    handle: createDataCommandRunner({ type: '_mmr', showSettings: true }),
})

MessageHandler.withPrefix.register({
    commands: ['fcData', 'fcd'],
    isCommand: (command) => /^fcd(ata)?\d+$/.test(command),
    handle: createDataCommandRunner({ type: '_mmr', showSettings: true }, 'fcs'),
})

MessageHandler.withPrefix.register({
    commands: ['roomData', 'rd'],
    isCommand: (command) => /^rd(ata)?\d+$/.test(command),
    handle: createDataCommandRunner({ type: '_mmr', showSettings: true }, 'room'),
})

MessageHandler.withPrefix.register({
    commands: ['links', 'mkc'],
    handle: createDataCommandRunner({ type: 'links' }),
})

MessageHandler.withPrefix.register({
    commands: ['mmr'],
    isCommand: (command) => /^(mmr|peak)\d+$/.test(command),
    handle: createDataCommandRunner({ type: '_mmr' }),
})

MessageHandler.withPrefix.register({
    commands: ['fcMmr', 'fcm'],
    isCommand: (command) => /^(fcmmr|fcm)\d+$/.test(command),
    handle: createDataCommandRunner({ type: '_mmr' }, 'fcs'),
})

MessageHandler.withPrefix.register({
    commands: ['peak'],
    isCommand: (command) => /^(mmr|peak)\d+$/.test(command),
    handle: createDataCommandRunner({ type: '_peak' }),
})

MessageHandler.withPrefix.register({
    commands: ['averageMmr', 'avgMmr'],
    isCommand: (command) => /^(average|avg)mmr\d+$/.test(command),
    handle: createDataCommandRunner({ type: 'averageMmr' }),
})

MessageHandler.withPrefix.register({
    commands: ['averageRoomMmr', 'avgRoomMmr', 'averageRoom', 'avgRoom'],
    isCommand: (command) => /^(average|avg)room(mmr)?\d+$/.test(command),
    handle: createDataCommandRunner({ type: 'averageRoomMmr' }),
})

MessageHandler.withPrefix.register({
    commands: ['base'],
    isCommand: (command) => /^base\d+$/.test(command),
    handle: createDataCommandRunner({ type: 'baseMmr' }),
})

MessageHandler.withPrefix.register({
    commands: ['names', 'nameLog', 'nameHistory'],
    handle: createDataCommandRunner({ type: 'nameHistory' }),
})

MessageHandler.withPrefix.register({
    commands: ['strikes'],
    isCommand: (command) => /^strikes\d+$/.test(command),
    handle: createDataCommandRunner({ type: 'strikes' }),
})
