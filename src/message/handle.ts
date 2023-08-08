import { Locale, Message } from 'discord.js'
import { BotError, LocalizedBotError } from '@/utilities/error'
import { MessageHandler } from './handler'
import { handleTrackMessage } from '@/features/track/message'
import { handleSokujiMessage } from '@/features/sokuji/message'

const prefixes = ['%', '％']

export const handleMessage = async (message: Message) => {
    if (message.author.bot) return
    try {
        const match = message.content.trim().match(/^(\S*)\s*([\S\s]*)$/)
        if (!match) return
        const command = match[1].toLowerCase()
        const arg = match[2]
        for (const prefix of prefixes) {
            if (command.startsWith(prefix)) {
                const commandWithoutPrefix = command.slice(prefix.length)
                if (await MessageHandler.withPrefix.handle(message, commandWithoutPrefix, arg)) return
            }
        }
        if (await handleTrackMessage(message)) return
        if (await handleSokujiMessage(message)) return
    } catch (error) {
        if (error instanceof BotError) {
            await message.channel.send(error.options)
        } else if (error instanceof LocalizedBotError) {
            await message.channel.send(
                message.guild?.preferredLocale === Locale.Japanese ? error.getMessage('ja') : error.getMessage('en'),
            )
        } else {
            console.error(`Unexpected error when handling message (${message.content}): ${error}`)
            await message.channel.send(
                message.guild?.preferredLocale === Locale.Japanese
                    ? '予期せぬエラーが発生しました。'
                    : 'An unexpected error has occurred.',
            )
        }
    }
}
