import { Lounge } from 'mk8dx'
import { EmbedBuilder } from 'discord.js'
import { Command } from '@/utilities'
import { LoungeService } from '@/services'

export class TableCommand extends Command<{
    tableId: number
}> {
    async run() {
        await this.defer()
        const table = await LoungeService.getTable(this.options)
        await this.reply({ embeds: [createTableEmbed(table)] })
    }
}

export const createTableEmbed = (table: Lounge.TableDetails): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle(`Table (ID: ${table.id})`)
        .setURL(`https://mk8dx-lounge.com/TableDetails/${table.id}`)
        .setColor(
            getDivisionColor({
                season: table.season,
                mmrs: table.teams
                    .flatMap((team) => team.scores.map((score) => score.prevMmr))
                    .filter((mmr) => mmr !== undefined) as number[],
            }) ?? null,
        )
        .setImage(
            table.url.startsWith('/')
                ? `https://mk8dx-lounge.com${table.url}`
                : `https://mk8dx-lounge.com/${table.url}`,
        )
        .addFields(
            {
                name: 'Season',
                value: table.season.toString(),
                inline: true,
            },
            {
                name: 'Tier',
                value: table.tier,
                inline: true,
            },
            {
                name: 'Format',
                value: table.format,
                inline: true,
            },
            {
                name: 'Created',
                value: `<t:${Math.floor(Lounge.convertToDate(table.createdOn).getTime() / 1000)}>`,
                inline: true,
            },
        )
    if (table.verifiedOn) {
        embed.addFields({
            name: 'Verified',
            value: `<t:${Math.floor(Lounge.convertToDate(table.verifiedOn).getTime() / 1000)}>`,
            inline: true,
        })
    }
    if (table.deletedOn) {
        embed.addFields({
            name: 'Deleted',
            value: `<t:${Math.floor(Lounge.convertToDate(table.deletedOn).getTime() / 1000)}>`,
            inline: true,
        })
    }
    if (
        table.teams.every((team) =>
            team.scores.every(
                (score) => score.prevMmr !== undefined && score.newMmr !== undefined && score.delta !== undefined,
            ),
        )
    ) {
        embed.addFields({
            name: 'MMR Changes',
            value: createMmrChangesTextFromTable(table),
        })
    } else {
        embed.addFields({
            name: 'Expected MMR Changes',
            value: createMmrChangesTextFromTable(Lounge.expectTableDetails(table)),
        })
    }
    return embed
}

export const getDivisionColor = (options: { season?: number; mmrs: number[] }) => {
    if (!options.mmrs.length) return
    return Lounge.Season.get(options.season).getDivision(options.mmrs.reduce((a, b) => a + b, 0) / options.mmrs.length)
        .color
}

export const createMmrChangesText = (
    players: {
        name: string
        prevMmr: number
        newMmr: number
        delta: number
    }[],
) => {
    const maxLength = {
        name: Math.max(0, ...players.map((player) => player.name.length)),
        prevMmr: Math.max(0, ...players.map(({ prevMmr }) => prevMmr)).toString().length,
        newMmr: Math.max(0, ...players.map(({ newMmr }) => newMmr)).toString().length,
        delta: Math.max(0, ...players.map(({ delta }) => Math.abs(delta))).toString().length,
    }
    return (
        '```ansi\n' +
        players
            .map((player) => {
                return (
                    `\u001b[0m\u001b[1m${player.name.padEnd(maxLength.name)}\u001b[0m: ` +
                    player.prevMmr.toString().padStart(maxLength.prevMmr) +
                    ' → ' +
                    player.newMmr.toString().padStart(maxLength.newMmr) +
                    '\u001b[30m (' +
                    (player.delta >= 0 ? '\u001b[32m+' : '\u001b[31m-') +
                    Math.abs(player.delta).toString().padStart(maxLength.delta) +
                    '\u001b[30m)'
                )
            })
            .join('\n') +
        '```'
    )
}

export const createMmrChangesTextFromTable = (table: Lounge.TableDetails) =>
    createMmrChangesText(
        table.teams.flatMap((team) =>
            team.scores
                .sort((a, b) => b.score - a.score)
                .map((score) => ({
                    name: score.playerName,
                    prevMmr: score.prevMmr!,
                    newMmr: score.newMmr!,
                    delta: score.delta!,
                })),
        ),
    )
