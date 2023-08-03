import AsyncLock from 'async-lock'
import { Client, InteractionReplyOptions, MessageCreateOptions, MessagePayload, Routes } from 'discord.js'

export type MessageOptions = Omit<InteractionReplyOptions & MessageCreateOptions, 'flags'>

export type Embed = NonNullable<MessageOptions['embeds']>[number]

export type Component = NonNullable<MessageOptions['components']>[number]

export const messageLock = new AsyncLock()

declare module 'discord.js' {
    interface Client {
        editMessage(channelId: string, messageId: string, options: MessageOptions): Promise<void>
        deleteMessage(channelId: string, messageId: string): Promise<void>
    }
}

Client.prototype.editMessage = async function (channelId, messageId, options) {
    const channel = this.channels.cache.get(channelId)
    if (channel) {
        if (channel.isTextBased()) await channel.messages.edit(messageId, options)
        return
    }
    const { body, files } = await MessagePayload.create(
        // @ts-expect-error: force to use
        { client: this },
        options,
    )
        .resolveBody()
        .resolveFiles()
    await this.rest.patch(Routes.channelMessage(channelId, messageId), {
        body,
        files: files ?? undefined,
    })
}

Client.prototype.deleteMessage = async function (channelId, messageId) {
    const channel = this.channels.cache.get(channelId)
    if (channel) {
        if (channel.isTextBased()) await channel.messages.delete(messageId)
        return
    }
    await this.rest.delete(Routes.channelMessage(channelId, messageId))
}
