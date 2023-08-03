import { APIRole, EmbedBuilder, Role } from 'discord.js'
import { Lounge } from 'mk8dx'
import { Command, createTextError, extractUsers } from '@/utilities'
import { LoungeService } from '@/services'

export class FcCommand extends Command<{
    players?: string
    role?: Role | APIRole
}> {
    async run() {
        if (this.options.players?.trim()) {
            await this.replyFc(
                await Promise.all(
                    extractUsers(this.options.players).map(async (user) => {
                        const data =
                            user.type === 'name'
                                ? await LoungeService.getPlayer({ name: user.value }, true)
                                : await LoungeService.getPlayer({ discordId: user.value }, true)
                        const name =
                            user.type === 'name'
                                ? user.value
                                : data
                                ? `${data.name} (<@${user.value}>)`
                                : `<@${user.value}>`
                        return { name, data }
                    }),
                ),
            )
            return
        }
        if (this.options.role) {
            const role =
                this.options.role instanceof Role
                    ? this.options.role
                    : await this.data.guild?.roles.fetch(this.options.role.id)
            if (!role)
                throw createTextError(
                    `Role (${this.options.role.name}) not found.`,
                    `ロール（${this.options.role.name}）が見つかりません。`,
                )
            await this.replyFc(
                await Promise.all(
                    role.members.map(async (member) => {
                        try {
                            const data = await LoungeService.getPlayer({
                                discordId: member.id,
                            })
                            return { name: `${data.name} (<@${member.id}>)`, data }
                        } catch {
                            return { name: `<@${member.id}>` }
                        }
                    }),
                ),
            )
            return
        }
        const data = await LoungeService.getPlayer({ discordId: this.user.id })
        await this.replyFc([{ name: data.name, data }])
    }

    async replyFc(
        players: {
            name: string
            data?: Lounge.Player
        }[],
    ) {
        if (players.length === 1) {
            const player = players[0]
            if (!player.data)
                throw createTextError(
                    `Player (${player.name}) not found.`,
                    `プレイヤー（${player.name}）が見つかりません。`,
                )
            if (!player.data.switchFc)
                throw createTextError(
                    `Player (${player.name}) has no Switch FC linked.`,
                    `プレイヤー（${player.name}）にフレンドコードが紐付けられていません。`,
                )
            await this.reply({ content: player.data.switchFc })
            return
        }
        const embed = new EmbedBuilder().setTitle('Switch FC')
        embed.addFields(
            players.map(({ name, data }) => ({
                name,
                value: data ? `[${data.switchFc ?? '-'}](https://mk8dx-lounge.com/PlayerDetails/${data.id})` : '?',
                inline: true,
            })),
        )
        await this.reply({ embeds: [embed] })
    }
}
