import { Command, Sokuji, sokujiLock } from '@/utilities'

export class NowCommand extends Command {
    async run() {
        await this.defer()
        await sokujiLock.acquire(this.data.channelId, async () => {
            const sokuji = await Sokuji.loadNow(this.data.channelId, true)
            const [message, _] = await Promise.all([
                this.reply({
                    ...(await sokuji.createMessage()),
                    fetchReply: true,
                }),
                sokuji.editPrevMessage(this.data.client, { components: 'delete' }),
            ])
            await sokuji.save(message.id)
        })
    }
}
