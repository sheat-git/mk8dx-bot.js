import { MessageHandler } from '@/message'
import { TrackService } from '@/services'
import { Sokuji, SokujiRace, createTextError, sokujiLock } from '@/utilities'

MessageHandler.withPrefix.register({
    commands: ['track', 't'],
    handle: async (message, _, arg) => {
        await sokujiLock.acquire(message.channelId, async () => {
            const sokuji = await Sokuji.loadNow(message.channelId, true)
            if (sokuji.races.length === 0)
                throw createTextError(
                    'Sokuji is still empty, so there is no editable track.',
                    '即時集計がまだ空なため、編集可能なコースがありません。',
                )
            const args = arg.split(/\s+/, 2)
            const i = Number(args[0]) - 1
            let n = null
            let race: SokujiRace
            let nick: string
            if (Number.isInteger(i) && 0 <= i && i < sokuji.races.length) {
                n = i + 1
                race = sokuji.races[i]
                nick = args.at(1) ?? ''
            } else {
                race = sokuji.races.at(-1)!
                nick = arg
            }
            race.track = await TrackService.search({ nick, userId: message.author.id, guildId: message.guildId })
            await Promise.all([
                sokuji.editPrevMessage(message.client, { embeds: 'overwrite' }),
                message.channel.send(
                    n
                        ? sokuji.isJa
                            ? `${n}レース目のコースを編集しました。`
                            : `Edited the track of race ${n}.`
                        : sokuji.isJa
                        ? '最新のコースを編集しました。'
                        : 'Edited the latest track.',
                ),
            ])
            await sokuji.save(true)
        })
    },
})

MessageHandler.withPrefix.register({
    commands: ['race', 'ranks', 'rank'],
    handle: async (message, _, arg) => {
        const args = arg.split(/\s+/).map((s) => (s === '?' ? null : s))
        let raceN: number | null = Number(args[0])
        let raceIndex = -1
        let ranks: (string | null)[]
        if (Number.isInteger(raceN) && raceN < 100) {
            if (raceN >= 0) raceIndex = raceN - 1
            else raceIndex = raceN
            ranks = args.slice(1)
        } else {
            raceN = null
            ranks = args
        }
        const illegalChars = ranks.join('').match(/[^＋ー０-９+\-0-9]/g)
        if (illegalChars)
            throw createTextError(
                `Invalid characters: ${illegalChars.join(' ')}`,
                `不正な文字: ${illegalChars.join(' ')}`,
            )
        await sokujiLock.acquire(message.channelId, async () => {
            const sokuji = await Sokuji.loadNow(message.channelId, true)
            const race = sokuji.races.at(raceIndex)
            if (!race)
                throw createTextError(
                    raceN !== null ? `Race ${raceN} does not exist.` : 'The target race does not exist.',
                    raceN !== null ? `${raceN}レース目は存在しません。` : '対象のレースが存在しません。',
                )
            let scores = race.scores
            for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] -= scores[i]
            race.set(ranks, true)
            race.validateOrder()
            scores = race.scores
            for (let i = 0; i < sokuji.teamNum; i++) sokuji.scores[i] += scores[i]
            await Promise.all([
                message.channel.send({
                    content: sokuji.isJa
                        ? `${raceN ?? sokuji.races.length}レース目の順位を編集しました。`
                        : `Edited the ranks of race ${raceN ?? sokuji.races.length}`,
                    embeds: sokuji.format !== 6 ? [await sokuji.createRaceEmbed(raceIndex)] : undefined,
                }),
                sokuji.editPrevMessage(message.client, {
                    content: 'overwrite',
                    embeds: 'overwrite',
                    files: 'overwrite',
                }),
            ])
            await sokuji.save(true)
        })
    },
})

MessageHandler.withPrefix.register({
    commands: ['back', 'undo'],
    handle: async (message) => {
        await sokujiLock.acquire(message.channelId, async () => {
            const sokuji = await Sokuji.loadNow(message.channelId, true)
            if (sokuji.pendingRace) {
                const race = sokuji.pendingRace
                const i = race.filled.lastIndexOf(true)
                if (i <= 0) {
                    await Promise.all([
                        message.channel.send(
                            sokuji.isJa ? '追加中のレースを削除しました。' : 'Deleted the pending race.',
                        ),
                        sokuji.deletePendingRaceMessage(message.client),
                    ])
                    await sokuji.save(true)
                    return
                }
                while (race.order.includes(i)) race.order[race.order.indexOf(i)] = null
                await Promise.all([
                    message.channel.send(
                        sokuji.isJa ? '追加中のレースを1つ戻しました。' : "Undo one team's ranks of the pending race.",
                    ),
                    sokuji.editPendingRaceMessage(message.client),
                ])
                await sokuji.saveWithPendingRace(sokuji.pendingRaceMessageId!)
                return
            }
            const lastEntry = sokuji.entries.at(-1)
            if (!lastEntry) throw createTextError('Sokuji is empty.', '即時集計が空です。')
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
            await Promise.all([
                message.channel.send(sokuji.isJa ? '1つ戻しました。' : 'Undo the latest.'),
                sokuji.editPrevMessage(message.client, {
                    content: 'overwrite',
                    embeds: 'overwrite',
                    files: 'overwrite',
                }),
            ])
            await sokuji.save(true)
        })
    },
})
