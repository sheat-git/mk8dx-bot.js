import { Lounge } from 'mk8dx'
import { APIRole, ComponentType, EmbedBuilder, Role } from 'discord.js'
import { Command, MessageOptions, createTextError, extractUsers } from '@/utilities'
import { extractTeams } from '../makeSubmit'
import { LoungeService } from '@/services'

export const extractPlayers = async (
    command: Command<{
        players?: string
        fcs?: string
        room?: string
        role?: Role | APIRole
        season?: number
    }>,
) => {
    const toName = (id: string) => {
        const member = command.data.guild?.members.cache.get(id)
        if (member) return member.displayName
        const user = command.data.client.users.cache.get(id)
        if (user) return user.username
        return `ID: ${id}`
    }
    if (command.options.players?.trim())
        return await Promise.all(
            extractUsers(command.options.players).map(async (user) => {
                const player = await LoungeService.getPlayer(
                    user.type === 'name'
                        ? { name: user.value, season: command.options.season }
                        : { discordId: user.value, season: command.options.season },
                    true,
                )
                if (!player)
                    return {
                        name: user.type === 'name' ? user.value : toName(user.value),
                    }
                return {
                    name: player.name,
                    data: player,
                }
            }),
        )
    if (command.options.fcs?.trim())
        return await Promise.all(
            [...command.options.fcs.matchAll(/(\d{4})-?(\d{4})-?(\d{4})/g)].map(async (match) => {
                const fc = match.slice(1).join('-')
                const player = await LoungeService.getPlayer({ fc, season: command.options.season }, true)
                if (!player) return { name: fc }
                return { name: `${player.name} (${fc})`, data: player }
            }),
        )
    if (command.options.room?.trim())
        return await Promise.all(
            extractTeams(command.options.room)
                .teams.flatMap((team) => team.players)
                .map(async (name) => {
                    const player = await LoungeService.getPlayer({ name, season: command.options.season }, true)
                    if (!player) return { name }
                    return { name: player.name, data: player }
                }),
        )
    if (command.options.role) {
        const guild = command.data.guildId ? await command.data.client.guilds.fetch(command.data.guildId) : null
        if (guild && guild.memberCount !== guild.members.cache.size) await guild?.members.fetch().catch(() => {})
        const members = guild?.members.cache.filter((member) => member.roles.cache.has(command.options.role!.id))
        if (!members || !members.size)
            throw createTextError(
                `Role (${command.options.role.name}) member not found.`,
                `ロール（${command.options.role.name}）のメンバーが見つかりません。`,
            )
        return await Promise.all(
            members.map(async (member) => {
                const player = await LoungeService.getPlayer(
                    { discordId: member.id, season: command.options.season },
                    true,
                )
                if (!player) return { name: member.displayName }
                return {
                    name: member.displayName !== player.name ? `${player.name} (${member.displayName})` : player.name,
                    data: player,
                }
            }),
        )
    }
    const player = await LoungeService.getPlayer({ discordId: command.user.id, season: command.options.season }, true)
    if (!player) return [{ name: command.memberDisplayName }]
    return [{ name: player.name, data: player }]
}

export class DataCommand extends Command<{
    players?: string
    fcs?: string
    room?: string
    role?: Role | APIRole
    season?: number
    type: DataType
    showSettings?: boolean
}> {
    async run() {
        await this.defer()
        const players: PlayerWithData[] = await extractPlayers(this)
        if (players.length > 24)
            throw createTextError(
                `You can only specify up to 24 players. ${players.length} players were specified.`,
                `最大24人までしか指定できません。${players.length}人が指定されました。`,
            )
        const options = {
            players: players.map((player) => ({ ...player, id: player.data?.id })),
            season: this.options.season,
            type: this.options.type,
            showSeason: this.options.showSettings ?? this.options.season !== undefined,
            showType: this.options.showSettings ?? false,
        }
        const message = await (() => {
            switch (this.options.type) {
                case 'links':
                case 'country':
                case 'switchFc':
                case '_mmr':
                case '_peak':
                case 'mmr+peak':
                case 'strikes':
                    // @ts-expect-error: ここのDataTypeはDataTypeWithDataになる
                    return createDataMessageWithData(options)
                default:
                    return createDataMessage(options)
            }
        })()
        await this.reply(message)
    }
}

type Player = {
    name: string
    id?: number
}

type PlayerWithData = Player & { data?: Lounge.Player }

type PlayerWithDetails = Player & { details?: Lounge.PlayerDetails }

export type DataType = keyof typeof dataTypes

type DataTypeWithData = Extract<DataType, 'links' | 'country' | 'switchFc' | '_mmr' | '_peak' | 'mmr+peak' | 'strikes'>
type DataTypeWithDetails = Exclude<DataType, DataTypeWithData>

export const dataTypes = {
    links: 'Links',
    country: 'Country',
    switchFc: 'Switch FC',
    baseMmr: 'Base MMR',
    _mmr: 'MMR',
    _peak: 'Peak MMR',
    'mmr+peak': 'MMR + Peak MMR',
    averageMmr: 'Average MMR',
    averageRoomMmr: 'Average Room MMR',
    winRate: 'Win Rate',
    last10: 'Last 10',
    largestDelta: 'Largest Change',
    averageScore: 'Average Score',
    overallRank: 'Overall Rank',
    eventsPlayed: 'Events Played',
    nameHistory: 'Name History',
    strikes: 'Strikes',
} as const

export const filteredDataTypes = Object.fromEntries(Object.entries(dataTypes).filter(([key]) => !key.startsWith('_')))

export const createDataMessage = async (options: {
    players: Player[]
    season?: number
    type: DataType
    showSeason: boolean
    showType: boolean
}): Promise<MessageOptions> => {
    switch (options.type) {
        case 'links':
        case 'country':
        case 'switchFc':
        case '_mmr':
        case '_peak':
        case 'mmr+peak':
        case 'strikes':
            return await createDataMessageWithData({
                players: await Promise.all(
                    options.players.map(async (player) => {
                        if (player.id === undefined) return { name: player.name }
                        return {
                            ...player,
                            data: await LoungeService.getPlayer({ id: player.id, season: options.season }, true),
                        }
                    }),
                ),
                season: options.season,
                type: options.type as DataTypeWithData,
                showSeason: options.showSeason,
                showType: options.showType,
            })
    }
    const players = await Promise.all(
        options.players.map(async (player) => {
            if (player.id === undefined) return player as PlayerWithDetails
            return {
                ...player,
                details: await LoungeService.getPlayerDetails({ id: player.id, season: options.season }, true),
            }
        }),
    )
    const averageMmr = (() => {
        const mmrs = players.map(({ details }) => details?.mmr).filter((mmr) => mmr !== undefined) as number[]
        if (mmrs.length === 0) return null
        return mmrs.reduce((a, b) => a + b, 0) / mmrs.length
    })()
    const embed = new EmbedBuilder().setTitle(dataTypes[options.type])
    if (averageMmr !== null) embed.setColor(Lounge.Season.get(options.season).getDivision(averageMmr).color)
    switch (options.type) {
        case 'baseMmr':
            buildBaseMmrEmbed(embed, players)
            break
        case 'averageMmr':
            buildAverageMmrEmbed(embed, players)
            break
        case 'averageRoomMmr':
            await buildAverageRoomMmrEmbed(embed, players)
            break
        default:
            buildOtherEmbed(embed, players, { averageMmr, type: options.type })
            break
    }
    return {
        embeds: [embed],
        components: createComponents({
            ...options,
            season: players.find((player) => player.details)?.details?.season,
        }),
    }
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const createDataMessageWithData = async (options: {
    players: PlayerWithData[]
    season?: number
    type: DataTypeWithData
    showSeason: boolean
    showType: boolean
}): Promise<MessageOptions> => {
    const averageMmr = (() => {
        const mmrs = options.players.map(({ data }) => data?.mmr).filter((mmr) => mmr !== undefined) as number[]
        if (mmrs.length === 0) return null
        return mmrs.reduce((a, b) => a + b, 0) / mmrs.length
    })()
    const embed = new EmbedBuilder().setTitle(dataTypes[options.type])
    if (averageMmr !== null) embed.setColor(Lounge.Season.get(options.season).getDivision(averageMmr).color)
    switch (options.type) {
        case 'strikes':
            await buildStrikesEmbed(embed, options.players, {
                season: options.season,
            })
            break
        default:
            embed.addFields(
                options.players.map((player) => {
                    if (player.id === undefined) return { name: player.name, value: '?', inline: true }
                    const url = createUrl({
                        playerId: player.id,
                        season: options.season,
                    })
                    if (!player.data) return { name: player.name, value: `[?](${url})`, inline: true }
                    return {
                        name: player.name,
                        inline: true,
                        value: (() => {
                            const data = player.data
                            switch (options.type as Exclude<DataTypeWithData, 'strikes'>) {
                                case 'links':
                                    return (
                                        `- [Lounge](${url}})\n` +
                                        `- [MKC Profile](https://www.mariokartcentral.com/mkc/registry/users/${data.mkcId})\n` +
                                        `- [MKC Forum](https://www.mariokartcentral.com/forums/index.php?members/${data.mkcId})`
                                    )
                                case 'country':
                                    if (!data.countryCode) return `[-](${url})`
                                    return (
                                        `:flag_${data.countryCode.toLowerCase()}: ` +
                                        `[${regionNames.of(data.countryCode) ?? '-'}](${url})`
                                    )
                                case 'switchFc':
                                    return `[${data.switchFc ?? '-'}](${url})`
                                case '_mmr':
                                    return `[${data.mmr ?? '-'}](${url})`
                                case '_peak':
                                    return `[${data.maxMmr ?? '-'}](${url})`
                                case 'mmr+peak':
                                    if (data.mmr === undefined) return `[-](${url})`
                                    return `[${data.mmr}](${url}) (${data.maxMmr ?? '-'})`
                            }
                        })(),
                    }
                }),
            )
    }
    if (options.players.filter((player) => player.data !== null).length > 1) {
        switch (options.type) {
            case '_mmr':
                embed.addFields({
                    name: 'Avg.',
                    value: averageValue(options.players.map(({ data }) => data?.mmr)),
                    inline: false,
                })
                break
            case '_peak':
                embed.addFields({
                    name: 'Avg.',
                    value: averageValue(options.players.map(({ data }) => data?.maxMmr)),
                    inline: false,
                })
                break
            case 'mmr+peak':
                embed.addFields({
                    name: 'Avg.',
                    value:
                        (averageMmr?.toFixed(1) ?? '-') +
                        ` (${averageValue(options.players.map(({ data }) => data?.maxMmr))})`,
                    inline: false,
                })
                break
        }
    }
    return { embeds: [embed], components: createComponents(options) }
}

const createComponents = (options: { type: DataType; season?: number; showSeason: boolean; showType: boolean }) => {
    const components: MessageOptions['components'] = []
    if (options.showSeason) {
        const specifiedSeason = options.season ?? Lounge.nowSeason
        const minSeason = Math.max(specifiedSeason - 12, 4)
        const maxSeason = Math.min(specifiedSeason + 12, Math.max(Lounge.nowSeason, specifiedSeason))
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.StringSelect,
                    custom_id: 'lounge_data_season',
                    placeholder: 'Season',
                    options: [...Array(maxSeason - minSeason + 1)].map((_, i) => {
                        const season = i + minSeason
                        return {
                            label: `Season ${season}`,
                            value: season.toString(),
                            default: season == specifiedSeason,
                        }
                    }),
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
                    custom_id: 'lounge_data_type',
                    placeholder: 'Type',
                    options: Object.entries(filteredDataTypes).map(([type, label]) => ({
                        label,
                        value: type,
                        default: type == options.type,
                    })),
                },
            ],
        })
    }
    return components
}

const createUrl = (options: { playerId: number; season?: number }) => {
    const url = `https://mk8dx-lounge.com/PlayerDetails/${options.playerId}`
    if (options.season === undefined) return url
    return url + `?season=${options.season}`
}

const averageValue = (values: (number | undefined)[]): string => {
    const filteredValues = values.filter((value) => value !== undefined) as number[]
    if (filteredValues.length === 0) return '-'
    return (filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length).toFixed(1)
}
const averagePlayerValue = (players: PlayerWithDetails[], detailsKey: keyof Lounge.PlayerDetails) =>
    averageValue(players.map((player) => player.details?.[detailsKey] as number | undefined))
const averageWinRate = (players: PlayerWithDetails[]): string => {
    const filteredPlayers = players.filter(({ details }) => details?.winRate !== undefined)
    if (filteredPlayers.length === 0) return '-'
    return (
        (filteredPlayers.reduce((a, b) => a + b.details!.winRate! * 100, 0) / filteredPlayers.length).toFixed(1) + ' %'
    )
}

const buildStrikesEmbed = async (
    embed: EmbedBuilder,
    players: PlayerWithData[],
    options: {
        season?: number
    },
) => {
    const penaltyLists = await Promise.all(
        players.map(async ({ data }) => {
            if (data === undefined) return
            return await LoungeService.getPenaltyList({
                name: data.name,
                season: options.season,
                isStrike: true,
                includeDeleted: false,
            })
        }),
    )
    embed.addFields(
        players.map((player, i) => {
            if (!player.data) return { name: player.name, value: '?', inline: true }
            const url = createUrl({
                playerId: player.data.id,
                season: options.season,
            })
            const penaltyList = penaltyLists[i]
            if (!penaltyList) return { name: player.name, value: `[-](${url})`, inline: true }
            return {
                name: player.name,
                value:
                    `[${penaltyList.length}](${url})\n` +
                    penaltyList
                        .map(
                            ({ awardedOn }) =>
                                `1. <t:${Math.floor(Lounge.convertToDate(awardedOn).getTime() / 1000)}:f>`,
                        )
                        .join('\n'),
                inline: true,
            }
        }),
    )
}

const buildBaseMmrEmbed = (embed: EmbedBuilder, players: PlayerWithDetails[]) => {
    const baseMmrs = players.map(({ details }) => {
        const mmrChange = details?.mmrChanges.at(-1)
        if (!mmrChange) return
        return mmrChange.newMmr - mmrChange.mmrDelta
    })
    embed.addFields(
        players.map((player, i) => {
            if (!player.details) return { name: player.name, value: '?', inline: true }
            const url = createUrl(player.details)
            return {
                name: player.name,
                value: `[${baseMmrs[i] ?? '-'}](${url})`,
                inline: true,
            }
        }),
    )
    if (players.filter((player) => player !== null).length > 1)
        embed.addFields({
            name: 'Avg.',
            value: averageValue(baseMmrs),
            inline: true,
        })
}

const buildAverageMmrEmbed = (embed: EmbedBuilder, players: PlayerWithDetails[]) => {
    const averageMmrs = players.map((player) => {
        const details = player.details
        if (!details) return
        const tableDeleteIds = new Set(
            details.mmrChanges.filter((c) => c.reason === 'TableDelete').map((c) => c.changeId),
        )
        const mmrs = details.mmrChanges
            .filter((c) => (c.reason === 'Table' && !tableDeleteIds.has(c.changeId)) || c.reason === 'Placement')
            .map((c) => c.newMmr)
        if (mmrs.length === 0) return
        return mmrs.reduce((a, b) => a + b, 0) / mmrs.length
    })
    embed.addFields(
        players.map((player, i) => {
            if (!player.details) return { name: player.name, value: '?', inline: true }
            const averageMmr = averageMmrs[i]
            return {
                name: player.name,
                inline: true,
                value: `[${averageMmr?.toFixed(1) ?? '-'}](${createUrl(player.details)})`,
            }
        }),
    )
    if (players.filter((player) => player !== null).length > 1)
        embed.addFields({
            name: 'Avg.',
            value: averageValue(averageMmrs),
            inline: false,
        })
}

const buildAverageRoomMmrEmbed = async (embed: EmbedBuilder, players: PlayerWithDetails[]) => {
    const deleteTableIds = new Set(
        players.flatMap(
            (player) =>
                player.details?.mmrChanges.filter((c) => c.reason === 'TableDelete').map((c) => c.changeId!) ?? [],
        ),
    )
    const playerTableIds = new Map(
        players
            .filter((player) => player.details)
            .map(({ details }) => {
                const tableIds = details!.mmrChanges
                    .filter((c) => c.reason === 'Table' && !deleteTableIds.has(c.changeId!))
                    .map((c) => c.changeId!)
                return [details!.playerId, tableIds]
            }),
    )
    const tables = new Map(
        (
            await Promise.all(
                [...new Set([...playerTableIds.values()].flat()).values()].map(async (tableId) => {
                    try {
                        const table = await LoungeService.getTable({ tableId })
                        const mmrs = table.teams
                            .flatMap((team) => team.scores.map((score) => score.prevMmr))
                            .filter((mmr) => mmr !== undefined) as number[]
                        if (mmrs.length) return [tableId, mmrs.reduce((a, b) => a + b, 0) / mmrs.length]
                    } catch {
                        return
                    }
                }),
            )
        ).filter((item) => item !== undefined) as [number, number][],
    )
    const averageRoomMmrs = players.map((player) => {
        const details = player.details
        if (!details) return
        const roomMmrs = playerTableIds
            .get(details.playerId)!
            .map((tableId) => tables.get(tableId))
            .filter((mmr) => mmr !== undefined) as number[]
        if (!roomMmrs.length) return
        return roomMmrs.reduce((a, b) => a + b, 0) / roomMmrs.length
    })
    embed.addFields(
        players.map((player, i) => {
            const details = player.details
            if (!details) return { name: player.name, value: '?', inline: true }
            const url = createUrl(details)
            return {
                name: player.name,
                inline: true,
                value: (() => {
                    const averageRoomMmr = averageRoomMmrs[i]
                    if (averageRoomMmr === undefined) return `[-](${url})`
                    return `[${averageRoomMmr.toFixed(1)}](${url})`
                })(),
            }
        }),
    )
    if (averageRoomMmrs.filter((mmr) => mmr !== undefined).length > 1)
        embed.addFields({
            name: 'Avg.',
            value: averageValue(averageRoomMmrs),
            inline: false,
        })
}

const buildOtherEmbed = (
    embed: EmbedBuilder,
    players: PlayerWithDetails[],
    options: {
        type: Exclude<DataTypeWithDetails, 'baseMmr' | 'averageMmr' | 'averageRoomMmr'>
        averageMmr: number | null
    },
) => {
    switch (options.type) {
        case 'last10':
            embed.setDescription('`Wins` - `Losses` / `MMR Change` (`Avg. Score`)')
            break
        case 'largestDelta':
            embed.setDescription('`Largest Gain` / `Largest Loss`')
            break
        case 'averageScore':
            embed.setDescription('`Avg.` (`Last 10 Avg.`) / `Partner Avg.`')
            break
    }
    embed.addFields(
        players.map((player) => {
            if (player.id === undefined) return { name: player.name, value: '?', inline: true }
            const url = createUrl({
                playerId: player.id,
                season: player.details?.season,
            })
            if (!player.details) return { name: player.name, value: `[?](${url})`, inline: true }
            return {
                name: player.name,
                inline: true,
                value: (() => {
                    const details = player.details
                    switch (options.type) {
                        case 'winRate':
                            if (details.winRate === undefined) return `[-](${url})`
                            return `[${(details.winRate * 100).toFixed(1)} %](${url})`
                        case 'last10':
                            const gainLossLastTen =
                                details.gainLossLastTen === undefined
                                    ? '-'
                                    : details.gainLossLastTen > 0
                                    ? `+${details.gainLossLastTen}`
                                    : `${details.gainLossLastTen}`
                            return (
                                `[${details.winLossLastTen} / ${gainLossLastTen}` +
                                ` (${details.averageLastTen?.toFixed(1) ?? '-'})](${url})`
                            )
                        case 'largestDelta':
                            const largestGain =
                                details.largestGain === undefined
                                    ? '\\-'
                                    : details.largestGainTableId === undefined
                                    ? `+${details.largestGain}`
                                    : `[+${details.largestGain}](https://mk8dx-lounge.com/TableDetails/${details.largestGainTableId})`
                            const largestLoss =
                                details.largestLoss === undefined
                                    ? '-'
                                    : details.largestLossTableId === undefined
                                    ? `${details.largestLoss}`
                                    : `[${details.largestLoss}](https://mk8dx-lounge.com/TableDetails/${details.largestLossTableId})`
                            return `${largestGain} [/](${url}) ${largestLoss}`
                        case 'averageScore':
                            if (details.averageScore === undefined) return `[-](${url})`
                            return (
                                `[${details.averageScore.toFixed(1)}` +
                                ` (${details.averageLastTen?.toFixed(1) ?? '-'})` +
                                ` / ${details.partnerAverage?.toFixed(1) ?? '-'}](${url})`
                            )
                        case 'overallRank':
                            return `[${details.overallRank ?? '-'}](${url})`
                        case 'eventsPlayed':
                            return `[${details.eventsPlayed ?? '-'}](${url})`
                        case 'nameHistory':
                            return details.nameHistory.length === 0
                                ? `[-](${url})`
                                : details.nameHistory
                                      .reverse()
                                      .map(
                                          (nameChange, i) =>
                                              `1. <t:${Math.floor(
                                                  Lounge.convertToDate(nameChange.changedOn).getTime() / 1000,
                                              )}:d> ` +
                                              (i === details.nameHistory.length - 1
                                                  ? `[${nameChange.name}](${url})`
                                                  : nameChange.name),
                                      )
                                      .join('\n')
                    }
                })(),
            }
        }),
    )
    if (players.filter((player) => player.details !== null).length > 1) {
        switch (options.type) {
            case 'winRate':
                embed.addFields({
                    name: 'Avg.',
                    value: averageWinRate(players),
                    inline: false,
                })
                break
            case 'last10':
                const gainLossLastTen = averagePlayerValue(players, 'gainLossLastTen')
                embed.addFields({
                    name: 'Avg.',
                    value:
                        averagePlayerValue(players, 'winsLastTen') +
                        ` - ${averagePlayerValue(players, 'lossesLastTen')}` +
                        ` / ${gainLossLastTen.startsWith('-') ? gainLossLastTen : '+' + gainLossLastTen}` +
                        ` (${averagePlayerValue(players, 'averageLastTen')})`,
                    inline: false,
                })
                break
            case 'averageScore':
                embed.addFields({
                    name: 'Avg.',
                    value:
                        `${averagePlayerValue(players, 'averageScore')}` +
                        ` (${averagePlayerValue(players, 'averageLastTen')})` +
                        ` / ${averagePlayerValue(players, 'partnerAverage')}`,
                    inline: false,
                })
                break
            case 'overallRank':
                embed.addFields({
                    name: 'Avg.',
                    value: averagePlayerValue(players, 'overallRank'),
                    inline: false,
                })
                break
            case 'eventsPlayed':
                embed.addFields({
                    name: 'Avg.',
                    value: averagePlayerValue(players, 'eventsPlayed'),
                    inline: false,
                })
                break
        }
    }
}
