import { MessageHandler } from '@/message'
import { BotError } from '@/utilities'
import { TableCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['table'],
    handle: async (message, _, arg) => {
        const tableId = parseInt(arg)
        if (Number.isNaN(tableId))
            throw new BotError({
                content: `The argument is incorrect.\nExample: \`%table 50000\``,
            })
        await new TableCommand(message, { tableId }).run()
    },
})
