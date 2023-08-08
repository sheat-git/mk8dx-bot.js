import { Command, Sokuji, sokujiLock } from '@/utilities'

export class OtherCommand extends Command<{
    tag?: string
    score: number
    reason: string
}> {
    async run() {
        await this.defer()
        const tags = this.options.tag?.split(/\s+/).filter(Boolean) ?? []
        await sokujiLock.acquire(this.data.channelId, async () => {
            const sokuji = await Sokuji.loadNow(this.data.channelId, true)
            const scores = [...Array(sokuji.teamNum)].map((_, i) => {
                if ((!tags.length && i === 0) || tags.includes(sokuji.tags[i])) return this.options.score
                return 0
            })
            for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] += scores[i]
            const n = sokuji.races.length
            if (n in sokuji.others) sokuji.others[n].push({ scores, reason: this.options.reason })
            else sokuji.others[n] = [{ scores, reason: this.options.reason }]
            await Promise.all([
                sokuji.editPrevMessage(this.data.client, {
                    content: 'overwrite',
                    embeds: 'overwrite',
                    files: 'overwrite',
                }),
                this.reply({
                    content: sokuji.isJa ? `${this.options.reason} を追加しました。` : `Added ${this.options.reason}.`,
                }),
            ])
            await sokuji.save(true)
        })
    }
}
