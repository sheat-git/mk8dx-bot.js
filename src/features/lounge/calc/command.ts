import { ComponentType } from 'discord.js'
import { Lounge } from 'mk8dx'
import { Command, MessageOptions, createTextError } from '@/utilities'
import { LoungeService } from '@/services'
import { createMmrChangesTextFromTable, getDivisionColor } from '../table'
import { extractTeams } from '../makeSubmit'

export class CalcCommand extends Command<{
    arg?: string
}> {
    async run() {
        if (!this.options.arg?.trim()) {
            await this.defer()
            for (const table of (await LoungeService.getTableUnverified({})).reverse()) {
                if (table.teams.some((team) => team.scores.some((score) => score.playerDiscordId === this.user.id))) {
                    await this.reply(createCalcMessageFromTable(table))
                    return
                }
            }
            throw createTextError(
                'All of your tables are updated. There is no table to calculate.',
                'あなたのテーブルは全てアップデートされています。計算対象がありません。',
            )
        }
        const tableId = Number(this.options.arg)
        if (Number.isInteger(tableId)) {
            await this.defer()
            const table = await LoungeService.getTable({ tableId })
            await this.reply(createCalcMessageFromTable(table))
            return
        }
        const match = this.options.arg.match(/^(\d),?\s*((?:[^,]+,\s*){11}[^,]+)$/)
        const teams = match
            ? ((() => {
                  const format = parseInt(match[1])
                  const players = match[2].split(/,\s*/)
                  return [...Array(12 / format)].map((_, i) => ({
                      players: players.slice(i * format, (i + 1) * format),
                  }))
              })() as Teams)
            : extractTeams(this.options.arg).teams
        if (teams.every((team) => team.averageMmr !== undefined)) {
            await this.reply(createCalcMessage({ teams: convert(teams as RequiredTeams), index: 0 }))
            return
        }
        await this.defer()
        const requiredTeams = await Promise.all(
            teams.map(async (team) => {
                const players = await Promise.all(
                    team.players.map(async (name) => {
                        const player = await LoungeService.getPlayer({ name })
                        if (player.mmr === undefined)
                            throw createTextError(
                                `Player (${name}) does not have MMR. It may be Placement.`,
                                `プレイヤー（${name}）のMMRがないため計算できません。Placementの可能性があります。`,
                            )
                        return player
                    }),
                )
                return {
                    players: team.players,
                    averageMmr: players.reduce((a, b) => a + b.mmr!, 0) / players.length,
                }
            }),
        )
        await this.reply(createCalcMessage({ teams: convert(requiredTeams), index: 0 }))
    }
}

type Teams = ReturnType<typeof extractTeams>['teams']
type RequiredTeams = Required<Teams[number]>[]

const convert = (teams: RequiredTeams) =>
    teams
        .sort((a, b) => b.averageMmr - a.averageMmr)
        .map((team, i) => ({
            label: `Team ${i + 1}: ${team.players.join(', ')}`,
            mmr: Math.round(team.averageMmr),
        }))

const createCalcMessageFromTable = (table: Lounge.TableDetails): MessageOptions => {
    return {
        embeds: [
            {
                title: 'Expected MMR Changes',
                url: `https://mk8dx-lounge.com/TableDetails/${table.id}`,
                description: createMmrChangesTextFromTable(Lounge.expectTableDetails(table)),
                color: getDivisionColor({
                    season: table.season,
                    mmrs: table.teams.flatMap((team) => team.scores.map((score) => score.prevMmr!)),
                }),
            },
        ],
    }
}

export const createCalcMessage = (options: {
    teams: {
        label: string
        mmr: number
    }[]
    index: number
}): MessageOptions => {
    const deltas = Lounge.expectMmrDeltas({
        mmr: options.teams[options.index].mmr,
        otherMmrs: [...options.teams.slice(0, options.index), ...options.teams.slice(options.index + 1)].map(
            (team) => team.mmr,
        ),
    }).map(({ min, max }) => ({
        min: min,
        max: min === max ? undefined : max,
    }))
    const maxLength = {
        rank: deltas.length.toString().length + 2,
        min: deltas.reduce((a, b) => Math.max(a, Math.abs(b.min).toString().length), 0),
        max: deltas.reduce((a, b) => Math.max(a, b.max === undefined ? 0 : Math.abs(b.max).toString().length), 0),
    }
    return {
        embeds: [
            {
                title: 'Expected MMR Changes',
                color: getDivisionColor({
                    mmrs: options.teams.map((team) => team.mmr),
                }),
                description:
                    '```ansi\n' +
                    deltas
                        .map((delta, i) => {
                            let line =
                                '\u001b[0m' +
                                (() => {
                                    switch (i) {
                                        case 0:
                                            return '1st'
                                        case 1:
                                            return '2nd'
                                        case 2:
                                            return '3rd'
                                        default:
                                            return `${i + 1}th`
                                    }
                                })().padStart(maxLength.rank) +
                                ': '
                            if (delta.min < 0) line += '\u001b[31m-'
                            else line += '\u001b[32m+'
                            line += Math.abs(delta.min).toString().padStart(maxLength.min)
                            if (delta.max !== undefined) {
                                line += '\u001b[0m ~ '
                                if (delta.max < 0) line += '\u001b[31m-'
                                else line += '\u001b[32m+'
                                line += Math.abs(delta.max).toString().padStart(maxLength.max)
                            }
                            return line
                        })
                        .join('\n') +
                    '```',
            },
        ],
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.StringSelect,
                        custom_id: 'lounge_calc_teams',
                        placeholder: 'Select a team',
                        options: options.teams.map((team, i) => ({
                            label: team.label,
                            value: i.toString(),
                            default: i === options.index,
                            description: `MMR: ${team.mmr}`,
                        })),
                    },
                ],
            },
        ],
    }
}
