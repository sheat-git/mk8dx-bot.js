import { Message } from 'discord.js'
import { LatestTrackService, TrackService } from '@/services/track'
import '@/utilities/track'

export const handleTrackMessage = async (message: Message): Promise<boolean> => {
    const track = await TrackService.search({
        nick: message.content,
        userId: message.author.id,
        guildId: message.guild?.id,
    })
    if (track === null) return false
    LatestTrackService.default.put(message.channelId, track.id).catch(() => {})
    await message.channel.send({ embeds: [track.toEmbed()] })
    return true
}
