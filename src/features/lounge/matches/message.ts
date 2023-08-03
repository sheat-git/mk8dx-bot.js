import { Message } from 'discord.js'
import { MessageHandler } from '@/message'
import { MatchesCommand } from './command'

const createMatchesCommandRunner =
    (config: MatchesCommand['options'], argType: 'players' | 'fcs' | 'room' = 'players') =>
    async (message: Message, command: string, arg: string) => {
        const options = { ...config }
        const season = command.match(/\d+/)?.[0]
        if (season) options.seasons = season
        options[argType] = arg
        await new MatchesCommand(message, options as MatchesCommand['options']).run()
    }

MessageHandler.withPrefix.register({
    commands: ['matches', 'match'],
    isCommand: (command) => /^matches\d+$/.test(command),
    handle: createMatchesCommandRunner({ type: 'tier', showSettings: true }),
})

MessageHandler.withPrefix.register({
    commands: ['tierMatches', 'tierMatch', 'tm', 'tierData', 'td', 'tiers'],
    isCommand: (command) => /^(tier(match(es)?|data|s)|tm|td)\d+$/.test(command),
    handle: createMatchesCommandRunner({ type: 'tier' }),
})

MessageHandler.withPrefix.register({
    commands: ['formatMatches', 'formatMatch', 'fm', 'formatData', 'fd', 'formats'],
    isCommand: (command) => /^(format(match(es)?|data|s)|fm|fd)\d+$/.test(command),
    handle: createMatchesCommandRunner({ type: 'format' }),
})

MessageHandler.withPrefix.register({
    commands: ['monthlyMatches', 'monthlyMatch', 'mm', 'monthlyData', 'md', 'monthly'],
    isCommand: (command) => /^(monthly(match(es)?|data)?|mm|md)\d+$/.test(command),
    handle: createMatchesCommandRunner({ type: 'monthly' }),
})

MessageHandler.withPrefix.register({
    commands: ['weeklyMatches', 'weeklyMatch', 'wm', 'weeklyData', 'wd', 'weekly'],
    isCommand: (command) => /^(weekly(match(es)?|data)?|wm|wd)\d+$/.test(command),
    handle: createMatchesCommandRunner({ type: 'weekly' }),
})

MessageHandler.withPrefix.register({
    commands: ['dailyMatches', 'dailyMatch', 'dm', 'dailyData', 'dd', 'daily'],
    isCommand: (command) => /^(daily(match(es)?|data)?|dm|dd)\d+$/.test(command),
    handle: createMatchesCommandRunner({ type: 'daily' }),
})

MessageHandler.withPrefix.register({
    commands: ['hourlyMatches', 'hourlyMatch', 'hm', 'hourlyData', 'hd', 'hourly'],
    isCommand: (command) => /^(hourly(match(es)?|data)?|hm|hd)\d+$/.test(command),
    handle: createMatchesCommandRunner({ type: 'hourly' }),
})
