import { Lounge } from 'mk8dx'
import { APIRole, ComponentType, EmbedBuilder, Role } from 'discord.js'
import { utcToZonedTime } from 'date-fns-tz'
import { addMonths, format, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns'
import { Command, MessageOptions, calcTierIndex, createTextError, expectTimezone, timezones } from '@/utilities'
import { LoungeService } from '@/services'
import { extractPlayers } from '../data'

export class MatchesCommand extends Command<{
    players?: string
    fcs?: string
    room?: string
    role?: Role | APIRole
    seasons?: string
    type: MacthesType
    showSettings?: boolean
}> {
    async run() {
        await this.defer()
        const players: Player[] = (await extractPlayers(this)).map((player) => ({
            name: player.name,
            id: player.data?.id,
        }))
        if (players.length > 25)
            throw createTextError(
                `You can only specify up to 25 players. ${players.length} players were specified.`,
                `最大25人までしか指定できません。${players.length}人が指定されました。`,
            )
        await this.reply(
            await createMatchesMessage({
                players,
                seasons: this.options.seasons?.split(/\D/).map(Number).filter(Number.isInteger),
                type: this.options.type,
                showSeasons: this.options.showSettings ?? Boolean(this.options.seasons?.length),
                showType: this.options.showSettings ?? false,
                timezone: expectTimezone(this.locale),
            }),
        )
    }
}

type Player = {
    name: string
    id?: number
}

export type MacthesType = keyof typeof matchesTypes

export const matchesTypes = {
    tier: 'Tiers',
    format: 'Formats',
    monthly: 'Monthly Matches',
    weekly: 'Weekly Matches',
    daily: 'Daily Matches',
    hourly: 'Hourly Matches',
} as const

export const createMatchesMessage = async (options: {
    players: Player[]
    seasons?: number[]
    type: MacthesType
    showSeasons: boolean
    showType: boolean
    timezone: string
}): Promise<MessageOptions> => {
    let latestSeason: number | undefined
    const seasons = new Set<number>()
    const players: PlayerWithTables[] = await Promise.all(
        options.players.map(async (player) => {
            if (player.id === undefined) return { ...player, tables: null }
            let mmr: number | undefined
            const tables = (
                await Promise.all(
                    (options.seasons?.length ? options.seasons.sort((a, b) => b - a) : [undefined]).map(
                        async (season) => {
                            const details = await LoungeService.getPlayerDetails({ id: player.id, season }, true)
                            if (!details) return []
                            seasons.add(details.season)
                            if (latestSeason === undefined || details.season > latestSeason)
                                latestSeason = details.season
                            if (details.season === latestSeason) mmr = details.mmr
                            const tableDeleteIds = new Set(
                                details.mmrChanges.filter((c) => c.reason === 'TableDelete').map((c) => c.changeId),
                            )
                            return details.mmrChanges.filter(
                                (c) => c.reason === 'Table' && !tableDeleteIds.has(c.changeId),
                            )
                        },
                    ),
                )
            ).flat()
            return { ...player, tables, mmr }
        }),
    )
    const embed = new EmbedBuilder().setTitle(matchesTypes[options.type]).setColor(
        (() => {
            const mmrs = players.map(({ mmr }) => mmr).filter((mmr) => mmr !== undefined) as number[]
            if (mmrs.length === 0) return null
            return Lounge.Season.get(latestSeason).getDivision(mmrs.reduce((a, b) => a + b, 0) / mmrs.length).color
        })(),
    )
    const components: MessageOptions['components'] = []
    if (options.showSeasons) {
        const season = latestSeason ?? Lounge.nowSeason
        const minSeason = Math.max(season - 12, 4)
        const maxSeason = Math.min(season + 12, Math.max(Lounge.nowSeason, season))
        const seasonOptions = [...Array(maxSeason - minSeason + 1)].map((_, i) => i + minSeason)
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.StringSelect,
                    customId: 'lounge_matches_seasons',
                    placeholder: 'Seasons',
                    options: seasonOptions.map((season) => ({
                        label: `Season ${season}`,
                        value: season.toString(),
                        default: seasons.has(season),
                    })),
                    minValues: 1,
                    maxValues: seasonOptions.length,
                },
            ],
        })
    }
    if (options.showType) {
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.StringSelect,
                    customId: 'lounge_matches_type',
                    placeholder: 'Type',
                    options: Object.entries(matchesTypes).map(([value, label]) => ({
                        label,
                        value,
                        default: value === options.type,
                    })),
                },
            ],
        })
    }
    switch (options.type) {
        case 'tier':
        case 'format':
            buildStyleEmbed(embed, players, { type: options.type, latestSeason })
            break
        default:
            switch (options.type) {
                case 'monthly':
                    buildMonthlyEmbed(embed, players, {
                        latestSeason,
                        timezone: options.timezone,
                    })
                    break
                case 'weekly':
                    buildWeeklyEmbed(embed, players, {
                        latestSeason,
                        timezone: options.timezone,
                    })
                    break
                case 'daily':
                    buildDailyEmbed(embed, players, {
                        latestSeason,
                        timezone: options.timezone,
                    })
                    break
                case 'hourly':
                    buildHourlyEmbed(embed, players, {
                        latestSeason,
                        timezone: options.timezone,
                    })
                    break
            }
            components.push({
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.StringSelect,
                        customId: 'lounge_matches_timezone',
                        placeholder: 'Timezone',
                        options: timezones.map(({ id, description }) => ({
                            label: id,
                            value: id,
                            description,
                            default: id === options.timezone,
                        })),
                    },
                ],
            })
    }
    return { embeds: [embed], components }
}

type PlayerWithTables = Player & {
    tables: Lounge.MmrChange[] | null
    mmr?: number
}

const createUrl = (player: Player, season?: number) => {
    const baseUrl = `https://mk8dx-lounge.com/PlayerDetails/${player.id}`
    if (season === undefined) return baseUrl
    return `${baseUrl}?season=${season}`
}

const buildStyleEmbed = (
    embed: EmbedBuilder,
    players: PlayerWithTables[],
    options: {
        type: Extract<MacthesType, 'tier' | 'format'>
        latestSeason?: number
    },
) => {
    embed.addFields(
        players.map((player) => {
            const tables = player.tables
            if (!tables) return { name: player.name, value: '?', inline: true }
            return {
                name: player.name,
                inline: true,
                value:
                    `Total: [${tables.length}](${createUrl(player, options.latestSeason)})` +
                    (tables.length
                        ? '```' +
                          (() => {
                              switch (options.type) {
                                  case 'tier': {
                                      const tiers: Record<string, number> = {}
                                      for (const { tier } of tables) {
                                          if (tier === undefined) continue
                                          if (tier in tiers) tiers[tier]++
                                          else tiers[tier] = 1
                                      }
                                      const maxLength = Math.max(0, ...Object.values(tiers)).toString().length
                                      return Object.entries(tiers)
                                          .sort((a, b) => calcTierIndex(a[0]) - calcTierIndex(b[0]))
                                          .map(
                                              ([tier, count]) =>
                                                  `${tier.padEnd(2)}: ${count.toString().padStart(maxLength)}`,
                                          )
                                          .join('\n')
                                  }
                                  case 'format': {
                                      const nums: Record<number, number> = {}
                                      for (const { numTeams } of tables) {
                                          if (numTeams === undefined) continue
                                          if (numTeams in nums) nums[numTeams]++
                                          else nums[numTeams] = 1
                                      }
                                      const maxLength = Math.max(0, ...Object.values(nums)).toString().length
                                      return Object.entries(nums)
                                          .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                                          .map(
                                              ([numTeams, count]) =>
                                                  `${
                                                      {
                                                          12: 'FFA',
                                                          6: '2v2',
                                                          4: '3v3',
                                                          3: '4v4',
                                                          2: '6v6',
                                                      }[numTeams]
                                                  }: ${count.toString().padStart(maxLength)}`,
                                          )
                                          .join('\n')
                                  }
                              }
                          })() +
                          '```'
                        : ''),
            }
        }),
    )
}

const buildEmptyEmbed = (embed: EmbedBuilder, players: PlayerWithTables[], latestSeason?: number) => {
    embed.addFields(
        players.map((player) => ({
            name: player.name,
            value: `Total: [0](${createUrl(player, latestSeason)})`,
            inline: true,
        })),
    )
}

const buildMonthlyEmbed = (
    embed: EmbedBuilder,
    players: PlayerWithTables[],
    options: {
        latestSeason?: number
        timezone: string
    },
) => {
    const getDatesAt = (index: number) =>
        players
            .map((player) => player.tables?.at(index)?.time)
            .filter((time): time is string => time !== undefined)
            .map((time) => Lounge.convertToDate(time))
    const getMonth = (date: Date) => {
        const zoned = utcToZonedTime(date, options.timezone)
        return startOfMonth(zoned)
    }
    const latestDates = getDatesAt(0)
    if (!latestDates.length) return buildEmptyEmbed(embed, players, options.latestSeason)
    const latestMonth = getMonth(latestDates.reduce((a, b) => (a > b ? a : b)))
    const startMonth = (() => {
        const oneYearAgo = subMonths(latestMonth, 11)
        const firstMonth = getMonth(getDatesAt(-1).reduce((a, b) => (a < b ? a : b)))
        return firstMonth < oneYearAgo ? oneYearAgo : firstMonth
    })()
    const months = [startMonth]
    while (months.at(-1)! < latestMonth) {
        months.push(addMonths(months.at(-1)!, 1))
    }
    const labels = months.map((month) => format(month, 'yyyy-MM'))
    embed.addFields(
        players.map((player) => {
            const tables = player.tables
            if (!tables) return { name: player.name, value: '?', inline: true }
            return {
                name: player.name,
                inline: true,
                value: (() => {
                    const counts: number[] = Array(months.length).fill(0)
                    let i = months.length - 1
                    for (const { time } of tables) {
                        const month = getMonth(Lounge.convertToDate(time))
                        while (month < months[i] && i >= 0) i--
                        if (i < 0) break
                        counts[i]++
                    }
                    const maxLength = Math.max(0, ...counts).toString().length
                    return (
                        `Total: [${counts.reduce((a, b) => a + b, 0)}](${createUrl(player, options.latestSeason)})` +
                        '```' +
                        labels.map((label, i) => `${label}: ${counts[i].toString().padStart(maxLength)}`).join('\n') +
                        '```'
                    )
                })(),
            }
        }),
    )
}

const buildWeeklyEmbed = (
    embed: EmbedBuilder,
    players: PlayerWithTables[],
    options: {
        latestSeason?: number
        timezone: string
    },
) => {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    embed.addFields(
        players.map((player) => {
            const tables = player.tables
            if (!tables) return { name: player.name, value: '?', inline: true }
            return {
                name: player.name,
                inline: true,
                value: (() => {
                    const counts: number[] = Array(7).fill(0)
                    for (const { time } of tables) {
                        const zoned = utcToZonedTime(Lounge.convertToDate(time), options.timezone)
                        counts[zoned.getDay()]++
                    }
                    const maxLength = Math.max(0, ...counts).toString().length
                    return (
                        `Total: [${tables.length}](${createUrl(player, options.latestSeason)})` +
                        '```' +
                        labels.map((label, i) => `${label}: ${counts[i].toString().padStart(maxLength)}`).join('\n') +
                        '```'
                    )
                })(),
            }
        }),
    )
}

const buildDailyEmbed = (
    embed: EmbedBuilder,
    players: PlayerWithTables[],
    options: {
        latestSeason?: number
        timezone: string
    },
) => {
    const getDatesAt = (index: number) =>
        players
            .map((player) => player.tables?.at(index)?.time)
            .filter((time): time is string => time !== undefined)
            .map((time) => Lounge.convertToDate(time))
    const latestDates = getDatesAt(0)
    if (!latestDates.length) return buildEmptyEmbed(embed, players, options.latestSeason)
    const getDate = (date: Date) => startOfDay(utcToZonedTime(date, options.timezone))
    const latestDate = getDate(latestDates.reduce((a, b) => (a > b ? a : b)))
    const dates = [...Array(14)].map((_, i) => subDays(latestDate, 13 - i))
    const labels = dates.map((date) => format(date, 'MM/dd'))
    embed.addFields(
        players.map((player) => {
            const tables = player.tables
            if (!tables) return { name: player.name, value: '?', inline: true }
            return {
                name: player.name,
                inline: true,
                value: (() => {
                    const counts: number[] = Array(dates.length).fill(0)
                    let i = dates.length - 1
                    for (const { time } of tables) {
                        const date = getDate(Lounge.convertToDate(time))
                        while (date < dates[i] && i >= 0) i--
                        if (i < 0) break
                        counts[i]++
                    }
                    const maxLength = Math.max(0, ...counts).toString().length
                    return (
                        `Total: [${counts.reduce((a, b) => a + b, 0)}](${createUrl(player, options.latestSeason)})` +
                        '```' +
                        labels.map((label, i) => `${label}: ${counts[i].toString().padStart(maxLength)}`).join('\n') +
                        '```'
                    )
                })(),
            }
        }),
    )
}

const buildHourlyEmbed = (
    embed: EmbedBuilder,
    players: PlayerWithTables[],
    options: {
        latestSeason?: number
        timezone: string
    },
) => {
    const labels = [...Array(8)].map(
        (_, i) => (i * 3).toString().padStart(2) + '-' + ((i + 1) * 3).toString().padStart(2),
    )
    embed.addFields(
        players.map((player) => {
            const tables = player.tables
            if (!tables) return { name: player.name, value: '?', inline: true }
            return {
                name: player.name,
                inline: true,
                value: (() => {
                    const rawCounts: number[] = Array(24).fill(0)
                    for (const { time } of tables) {
                        const zoned = utcToZonedTime(Lounge.convertToDate(time), options.timezone)
                        rawCounts[zoned.getHours()]++
                    }
                    const counts = [...Array(8)].map((_, i) =>
                        rawCounts.slice(i * 3, (i + 1) * 3).reduce((a, b) => a + b, 0),
                    )
                    const maxLength = Math.max(0, ...counts).toString().length
                    return (
                        `Total: [${tables.length}](${createUrl(player, options.latestSeason)})` +
                        '```' +
                        labels.map((label, i) => `${label}: ${counts[i].toString().padStart(maxLength)}`).join('\n') +
                        '```'
                    )
                })(),
            }
        }),
    )
}
