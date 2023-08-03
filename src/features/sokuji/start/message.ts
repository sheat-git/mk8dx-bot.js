import { MessageHandler } from '@/message'
import { StartCommand } from './command'
import { createTextError } from '@/utilities'

MessageHandler.withPrefix.register({
    commands: ['sokuji', 'start', 'cal', 'vs', 'v'],
    isCommand: (command) => /(sokuji|start|cal|vs?)\d/.test(command),
    handle: async (message, command, arg) => {
        const formatString = command.match(/\d$/)?.[0]
        const format = formatString ? parseInt(formatString) : undefined
        switch (format) {
            case undefined:
            case 2:
            case 3:
            case 4:
            case 6:
                break
            default:
                throw createTextError(
                    'Invalid format. The format must be 2, 3, 4, or 6.',
                    '無効な形式です。形式は2, 3, 4, 6のいずれかである必要があります。',
                )
        }
        await new StartCommand(message, {
            format,
            tags: arg.length ? arg : undefined,
        }).run()
    },
})
