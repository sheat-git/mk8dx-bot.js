import { Command } from '@/utilities'
import '@/utilities/track'
import { Track } from 'mk8dx'

export class RandomCommand extends Command {
    async run() {
        const track = Track.All[Math.floor(Math.random() * Track.All.length)]
        await this.reply({ embeds: [track.toEmbed()] })
    }
}
