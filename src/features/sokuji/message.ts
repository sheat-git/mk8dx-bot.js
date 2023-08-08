import { Sokuji, sokujiLock } from '@/utilities'
import { Message } from 'discord.js'

export const handleSokujiMessage = async (message: Message) => {
    const content = message.content.trim()
    if (!/^([＋ー０-９+\-0-9\s]+|back|undo)$/.test(content)) return false
    return await sokujiLock
        .acquire(message.channelId, async () => {
            const sokuji = await Sokuji.loadNow(message.channelId)
            if (sokuji === null || sokuji.isEnded) return false
            if (content === 'back' || content === 'undo') {
                if (sokuji.pendingRace) {
                    const race = sokuji.pendingRace
                    const i = race.filled.lastIndexOf(true)
                    if (i <= 0) {
                        await sokuji.deletePendingRaceMessage(message.client)
                        await sokuji.save(true)
                        return true
                    }
                    while (race.order.includes(i)) race.order[race.order.indexOf(i)] = null
                    const [newMessage] = await Promise.all([
                        message.channel.send(await sokuji.createRaceMessage(true)),
                        sokuji.deletePendingRaceMessage(message.client),
                    ])
                    await sokuji.saveWithPendingRace(newMessage.id)
                    return true
                }
                const lastEntry = sokuji.entries.at(-1)
                if (!lastEntry) return false
                const scores = lastEntry.scores
                for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] -= scores[i]
                if ('n' in lastEntry) sokuji.races.pop()
                else
                    sokuji.others[
                        Math.max(
                            ...Object.entries(sokuji.others)
                                .filter(([_, v]) => v.length)
                                .map(([k]) => Number(k)),
                        )
                    ].pop()
                const [newMessage] = await Promise.all([
                    message.channel.send(await sokuji.createMessage()),
                    sokuji.deletePrevMessage(message.client),
                ])
                await sokuji.save(newMessage.id)
                return true
            }
            if (sokuji.races.length === sokuji.raceNum) return false
            const race = sokuji.pendingRace ?? (await sokuji.startNextRace())
            if (race.add(content)) {
                sokuji.pushPendingRace()
                const [_, newMessage] = await Promise.all([
                    sokuji.format !== 6 ? message.channel.send(await sokuji.createRaceMessage(-1)) : null,
                    message.channel.send(await sokuji.createMessage()),
                    sokuji.deletePendingRaceMessage(message.client),
                    sokuji.deletePrevMessage(message.client),
                ])
                await sokuji.save(newMessage.id)
            } else {
                const [newMessage] = await Promise.all([
                    message.channel.send(await sokuji.createRaceMessage(true)),
                    sokuji.deletePendingRaceMessage(message.client),
                ])
                await sokuji.saveWithPendingRace(newMessage.id)
            }
            return true
        })
        .catch(() => false)
}
