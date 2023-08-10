import { Command, Sokuji, sokujiLock } from '@/utilities'

export class StartCommand extends Command<{
    format?: number
    tags?: string
}> {
    async run() {
        await this.defer()
        await sokujiLock.acquire(this.data.channelId, async () => {
            const [prevSokuji, newSokuji] = await Promise.all([
                Sokuji.loadNow(this.data.channelId),
                Sokuji.start({
                    guild: this.data.guildId ? await this.data.client.guilds.fetch(this.data.guildId) : null,
                    channelId: this.data.channelId,
                    format: this.options.format,
                    tags: this.options.tags?.split(/\s+/),
                }),
            ])
            if (prevSokuji && !prevSokuji.isEnded) {
                prevSokuji.isEnded = true
                prevSokuji.editPrevMessage(this.data.client, { components: 'overwrite' })
                prevSokuji.deleteConfigMessage(this.data.client)
                prevSokuji.save(true).catch(() => {})
            }
            const [configMessage, sokujiMessage] = await Promise.all([
                this.reply({
                    ...(await newSokuji.createConfigMessage()),
                    fetchReply: true,
                }),
                this.reply({
                    ...(await newSokuji.createMessage()),
                    fetchReply: true,
                }),
            ])
            await newSokuji.save(
                {
                    messageId: sokujiMessage.id,
                    configMessageId: configMessage.id,
                },
                true,
            )
        })
    }
}
