import { Sokuji, sokujiLock } from '@/utilities'
import { Message } from 'discord.js'

export const handleSokujiMessage = async (message: Message) => {
    const content = message.content.trim()
    if (!/^([＋ー０-９+\-0-9\s]+|back)$/.test(content)) return false
    return await sokujiLock
        .acquire(message.channelId, async () => {
            const sokuji = await Sokuji.loadNow(message.channelId)
            if (sokuji === null || sokuji.isEnded) return false
            if (sokuji.races.length === sokuji.raceNum) return false
            const race = sokuji.pendingRace ?? (await sokuji.startNextRace())
            if (race.add(content)) {
                sokuji.pushPendingRace()
                const [_, newMessage] = await Promise.all([
                    sokuji.format !== 6 ? message.channel.send(await sokuji.createRaceMessage(-1)) : Promise.resolve(),
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
