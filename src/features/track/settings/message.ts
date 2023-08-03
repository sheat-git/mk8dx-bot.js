import { MessageHandler } from '@/message'
import { SettingsCommand } from './command'

MessageHandler.withPrefix.register({
    commands: ['tracks'],
    handle: (message) =>
        new SettingsCommand(message, {
            isGuild: message.inGuild(),
        }).run(),
})
