import { Command, Sokuji, createTextError, sokujiLock } from '@/utilities'

export class EndCommand extends Command {
    async run() {
        await this.defer()
        await sokujiLock.acquire(this.data.channelId, async () => {
            const sokuji = await Sokuji.loadNow(this.data.channelId, true)
            if (sokuji.isEnded)
                throw createTextError('The sokuji has already ended.', '即時集計はすでに終了しています。')
            sokuji.isEnded = true
            await Promise.all([
                sokuji.editPrevMessage(this.data.client, { components: 'overwrite' }),
                sokuji.deleteConfigMessage(this.data.client),
                this.reply({ content: sokuji.isJa ? '即時集計を終了しました。' : 'Ended the sokuji.' }),
            ])
            await sokuji.save(true)
        })
    }
}
