import { createCanvas } from 'canvas'
import { Chart } from 'chart.js'
import { APISelectMenuOption, ButtonStyle, ComponentType } from 'discord.js'
import { Lounge } from 'mk8dx'
import { calcTierIndex, Command, extractUser, extractUsers, MessageOptions } from '@/utilities'
import { LoungeService } from '@/services'

export class StatsCommand extends Command<{
    name?: string
    season?: number
    slice?: SliceOption
    tiers?: string
    formats?: string
    partners?: string
}> {
    async run() {
        await this.defer()
        const [player, partners] = await Promise.all([
            (() => {
                if (this.options.name?.trim()) {
                    const user = extractUser(this.options.name)
                    if (user.type === 'name') return LoungeService.getPlayer({ name: user.value })
                    return LoungeService.getPlayer({ discordId: user.value })
                } else {
                    return LoungeService.getPlayer({ discordId: this.user.id })
                }
            })(),
            Promise.all(
                extractUsers(this.options.partners ?? '').map((partner) => {
                    if (partner.type === 'name') return LoungeService.getPlayer({ name: partner.value })
                    return LoungeService.getPlayer({ discordId: partner.value })
                }),
            ),
        ])
        await this.reply(
            await createStatsMessage({
                playerId: player.id,
                season: this.options.season,
                slice: this.options.slice,
                tiers: this.options.tiers
                    ?.split(/,|\s/)
                    .map((tier) => tier.trim().toUpperCase())
                    .filter(Boolean),
                formats: this.options.formats
                    ?.split(/[^\d]/)
                    .map(parseInt)
                    .filter((format) => !Number.isNaN(format)),
                partners: this.options.partners
                    ? partners.map((partner) => ({
                          id: partner.id,
                          name: partner.name,
                          isActive: true,
                      }))
                    : undefined,
            }),
        )
    }
}

export type SliceOption =
    | {
          type: 'first' | 'last'
          data: number
      }
    | {
          type: 'mid' | 'slice'
          data: [number?, number?]
      }
    | {
          type: 'all'
          data: undefined
      }

export const createStatsMessage = async (options: {
    playerId: number
    slice?: SliceOption
    season?: number
    tiers?: string[]
    formats?: number[]
    partners?: {
        id: number
        name: string
        isActive: boolean
    }[]
    showAll?: boolean
}): Promise<MessageOptions> => {
    const playerDetails = (await LoungeService.getPlayerDetails(
        { id: options.playerId, season: options.season },
        true,
    ))!
    const tableDeleteIds = new Set(
        playerDetails.mmrChanges
            .filter((mmrChange) => mmrChange.reason === 'TableDelete')
            .map((mmrChange) => mmrChange.changeId!),
    )
    const components: MessageOptions['components'] = []
    const showAll = options.showAll
        ? true
        : [options.season, options.slice, options.tiers, options.formats, options.partners].filter(
              (option) => option !== undefined,
          ).length >= 4
    const isFiltered = {
        tiers: false,
        formats: false,
    }
    // season
    if (showAll || options.season !== undefined) {
        const minSeason = Math.max(playerDetails.season - 12, 4)
        const maxSeason = Math.min(playerDetails.season + 12, Math.max(Lounge.nowSeason, playerDetails.season))
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.StringSelect,
                    custom_id: 'lounge_stats_season',
                    placeholder: 'Season',
                    options: [...Array(maxSeason - minSeason + 1)].map((_, i) => {
                        const season = i + minSeason
                        return {
                            label: `Season ${season}`,
                            value: season.toString(),
                            default: season == playerDetails.season,
                        }
                    }),
                },
            ],
        })
    }
    // slice
    if (showAll || options.slice !== undefined) {
        const selects: APISelectMenuOption[] = [
            {
                label: 'All',
                value: 'all',
                default: options.slice === undefined || options.slice.type === 'all',
            },
        ]
        // first
        selects.push({ label: 'First', value: 'first' })
        if (options.slice?.type === 'first')
            selects.push({
                label: `First ${options.slice.data}`,
                value: `first_${options.slice.data}`,
                default: true,
            })
        // mid
        selects.push({ label: 'Mid', value: 'mid' })
        if (options.slice?.type === 'mid')
            selects.push({
                label: `Mid ${options.slice.data[0] ?? ''}-${options.slice.data[1] ?? ''}`,
                value: `mid_${options.slice.data[0] ?? ''}_${options.slice.data[1] ?? ''}`,
                default: true,
            })
        // last
        selects.push({ label: 'Last', value: 'last' })
        if (options.slice?.type !== 'last' || options.slice.data !== 10) {
            selects.push({ label: 'Last 10', value: 'last_10' })
        }
        if (options.slice?.type === 'last')
            selects.push({
                label: `Last ${options.slice.data}`,
                value: `last_${options.slice.data}`,
                default: true,
            })
        // slice
        selects.push({ label: 'Slice', value: 'slice' })
        if (options.slice?.type === 'slice')
            selects.push({
                label: `Slice ${options.slice.data[0] ?? ''}:${options.slice.data[1] ?? ''}`,
                value: `slice_${options.slice.data[0] ?? ''}_${options.slice.data[1] ?? ''}`,
                default: true,
            })
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.StringSelect,
                    custom_id: 'lounge_stats_slice',
                    placeholder: 'First / Mid / Last',
                    options: selects,
                },
            ],
        })
    }
    if (showAll || options.tiers !== undefined || options.formats !== undefined || options.partners !== undefined) {
        const tables = playerDetails.mmrChanges.filter(
            (mmrChange) => mmrChange.reason === 'Table' && !tableDeleteIds.has(mmrChange.changeId!),
        )
        // tiers
        if (showAll || options.tiers !== undefined) {
            const tiers: Record<string, number> = Object.create(null)
            for (const mmrChange of tables) {
                if (mmrChange.tier) tiers[mmrChange.tier] = (tiers[mmrChange.tier] ?? 0) + 1
            }
            isFiltered.tiers = options.tiers?.some((tier) => tier in tiers) ?? false
            const tiersOptions = Object.entries(tiers)
                .sort((a, b) => {
                    return calcTierIndex(a[0]) - calcTierIndex(b[0])
                })
                .map(([tier, eventsPlayed]) => ({
                    label: tier,
                    description: `${eventsPlayed} Events`,
                    value: tier,
                    default: options.tiers?.includes(tier) ?? false,
                }))
                .slice(undefined, 25)
            if (tiersOptions.length) {
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.StringSelect,
                            custom_id: 'lounge_stats_tiers',
                            placeholder: 'Tiers',
                            min_values: 0,
                            max_values: tiersOptions.length,
                            options: tiersOptions,
                        },
                    ],
                })
            }
        }
        // formats
        if (showAll || options.formats !== undefined) {
            const formats: Record<number, number> = Object.create(null)
            for (const mmrChange of tables) {
                if (mmrChange.numTeams) {
                    const format = 12 / mmrChange.numTeams
                    formats[format] = (formats[format] ?? 0) + 1
                }
            }
            isFiltered.formats = options.formats?.some((format) => format in formats) ?? false
            const formatsOptions = Object.entries(formats)
                .sort((a, b) => +a[0] - +b[0])
                .map(([format, eventsPlayed]) => ({
                    label: +format === 1 ? 'FFA' : `${format}v${format}`,
                    description: `${eventsPlayed} Events`,
                    value: format.toString(),
                    default: options.formats?.includes(+format) ?? false,
                }))
                .slice(undefined, 25)
            if (formatsOptions.length) {
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.StringSelect,
                            custom_id: 'lounge_stats_formats',
                            placeholder: 'Formats',
                            min_values: 0,
                            max_values: formatsOptions.length,
                            options: formatsOptions,
                        },
                    ],
                })
            }
        }
        // partners
        if (showAll || options.partners !== undefined) {
            const partners: Record<number, number> = Object.create(null)
            for (const partner of options.partners ?? []) {
                partners[partner.id] = 0
            }
            for (const mmrChange of tables) {
                for (const partnerId of mmrChange.partnerIds ?? []) {
                    if (partnerId in partners) partners[partnerId]++
                }
            }
            const partnersOptions = [
                ...(options.partners?.map((partner) => ({
                    label: partner.name,
                    description: `${partners[partner.id]} Events`,
                    value: partner.id.toString(),
                    default: partner.isActive,
                })) ?? []),
                {
                    label: 'Add Partners',
                    value: 'add',
                },
            ].slice(undefined, 25)
            components.push({
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.StringSelect,
                        custom_id: 'lounge_stats_partners',
                        placeholder: 'Partners',
                        min_values: 0,
                        max_values: partnersOptions.length,
                        options: partnersOptions,
                    },
                ],
            })
        }
    }
    if (!showAll) {
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    custom_id: 'lounge_stats_settings',
                    label: components.length ? 'Edit More' : 'Edit',
                    emoji: { name: '🔧' },
                    style: ButtonStyle.Primary,
                },
            ],
        })
    }
    const slice = (() => {
        switch (options.slice?.type) {
            case 'first':
                return { end: options.slice.data }
            case 'mid':
                return { start: options.slice.data[0], end: options.slice.data[1] }
            case 'last':
                return { start: -options.slice.data }
            case 'slice':
                return { start: options.slice.data[0], end: options.slice.data[1] }
        }
    })()
    return {
        ...(isFiltered.tiers || isFiltered.formats || options.partners?.filter((p) => p.isActive).length
            ? createFilteredMessage({
                  playerDetails,
                  tableDeleteIds,
                  slice,
                  tiers: isFiltered.tiers ? options.tiers! : [],
                  formats: isFiltered.formats ? options.formats! : [],
                  partnerIds: options.partners?.filter((p) => p.isActive).map((p) => p.id) ?? [],
              })
            : createNotFilteredMessage({
                  playerDetails,
                  tableDeleteIds,
                  slice,
              })),
        components,
    }
}

const createNotFilteredMessage = (options: {
    playerDetails: Lounge.PlayerDetails
    tableDeleteIds: Set<number>
    slice?: { start?: number; end?: number }
}): MessageOptions => {
    if (options.playerDetails.mmrChanges.length === 0) {
        return createNotPlayedMessage(options.playerDetails)
    }
    const firstMmrChanges: Lounge.MmrChange[] = []
    const mmrChangeMatrix = options.playerDetails.mmrChanges
        .reduceRight((acc, mmrChange) => {
            if (mmrChange.reason === 'Placement') return acc
            if (mmrChange.reason === 'Table' && !options.tableDeleteIds.has(mmrChange.changeId!)) {
                acc.push([mmrChange])
            } else if (acc.length === 0) {
                firstMmrChanges.push(mmrChange)
            } else {
                acc.at(-1)!.push(mmrChange)
            }
            return acc
        }, Array<Lounge.MmrChange[]>())
        .slice(options.slice?.start, options.slice?.end)
    let peakMmr = -1
    let peakMmrTableId: number | undefined
    let sumMmr = 0
    let wins = 0
    let losses = 0
    let sumScore = 0
    let topScore = 0
    let topScoreTableId: number | undefined
    let sumPartnerScore = 0
    let partnerCount = 0
    let largestGain = -1
    let largestLoss = 0
    let largestGainTableId: number | undefined
    let largestLossTableId: number | undefined
    for (const mmrChanges of mmrChangeMatrix) {
        const firstMmrChange = mmrChanges[0]
        sumMmr += firstMmrChange.newMmr
        sumScore += firstMmrChange.score!
        if (firstMmrChange.score! > topScore) {
            topScore = firstMmrChange.score!
            topScoreTableId = firstMmrChange.changeId
        }
        sumPartnerScore += firstMmrChange.partnerScores?.reduce((a, b) => a + b, 0) ?? 0
        partnerCount += firstMmrChange.partnerScores?.length ?? 0
        if (firstMmrChange.mmrDelta >= 0) {
            wins++
        } else {
            losses++
        }
        for (const mmrChange of mmrChanges) {
            if (mmrChange.newMmr > peakMmr) {
                peakMmr = mmrChange.newMmr
                peakMmrTableId = mmrChange.reason === 'Table' ? mmrChange.changeId : undefined
            }
            if (mmrChange.mmrDelta > largestGain) {
                largestGain = mmrChange.mmrDelta
                largestGainTableId = mmrChange.reason === 'Table' ? mmrChange.changeId : undefined
            } else if (mmrChange.mmrDelta < largestLoss) {
                largestLoss = mmrChange.mmrDelta
                largestLossTableId = mmrChange.reason === 'Table' ? mmrChange.changeId : undefined
            }
        }
    }
    const eventsPlayed = wins + losses
    if (eventsPlayed === 0) {
        return createNotPlayedMessage(options.playerDetails)
    }
    const data = mmrChangeMatrix.map((mmrChanges) => {
        return {
            mmrs: mmrChanges.map((mmrChange) => mmrChange.newMmr),
        }
    })
    if (options.slice?.start === undefined && firstMmrChanges.length > 0) {
        for (const mmrChange of firstMmrChanges) {
            if (mmrChange.mmrDelta > largestGain) {
                largestGain = mmrChange.mmrDelta
                largestGainTableId = undefined
            } else if (mmrChange.mmrDelta < largestLoss) {
                largestLoss = mmrChange.mmrDelta
                largestLossTableId = undefined
            }
        }
        const mmrs = [
            firstMmrChanges[0].newMmr - firstMmrChanges[0].mmrDelta,
            ...firstMmrChanges.map((mmrChange) => mmrChange.newMmr),
        ]
        const maxMmr = Math.max(...mmrs)
        if (maxMmr > peakMmr) {
            peakMmr = maxMmr
            peakMmrTableId = undefined
        }
        data.unshift({ mmrs })
    } else {
        const baseMmr = mmrChangeMatrix[0][0].newMmr - mmrChangeMatrix[0][0].mmrDelta
        if (baseMmr > peakMmr) {
            peakMmr = baseMmr
            peakMmrTableId = undefined
        }
        data.unshift({ mmrs: [baseMmr] })
    }
    const mmr = data.at(-1)!.mmrs.at(-1)!
    const delta = mmr - data[0].mmrs[0]
    const canvas = createCanvas(1280, 720)
    const chart = new Chart(
        // @ts-expect-error: invalid type
        canvas.getContext('2d'),
        Lounge.createStatsChartConfig({
            season: options.playerDetails.season,
            data,
            setBackground: true,
        }),
    )
    const image = canvas.toBuffer('image/png')
    chart.destroy()
    return {
        files: [
            {
                name: 'stats.png',
                attachment: image,
            },
        ],
        embeds: [
            {
                title: options.playerDetails.name,
                url: `https://mk8dx-lounge.com/PlayerDetails/${options.playerDetails.playerId}?season=${options.playerDetails.season}`,
                color: Lounge.Season.get(options.playerDetails.season).getDivision(mmr).color,
                image: {
                    url: 'attachment://stats.png',
                    width: 1280,
                    height: 720,
                },
                fields: [
                    ...(!options.slice && options.playerDetails.overallRank
                        ? [
                              {
                                  name: 'Rank',
                                  value: options.playerDetails.overallRank.toString(),
                                  inline: false,
                              },
                          ]
                        : []),
                    {
                        name: 'MMR',
                        value: mmr.toString(),
                        inline: true,
                    },
                    {
                        name: 'Peak MMR',
                        value:
                            peakMmrTableId === undefined
                                ? peakMmr.toString()
                                : `[${peakMmr}](https://mk8dx-lounge.com/TableDetails/${peakMmrTableId})`,
                        inline: true,
                    },
                    {
                        name: 'Avg. MMR',
                        value: (sumMmr / eventsPlayed).toFixed(1),
                        inline: true,
                    },
                    {
                        name: 'Win Rate',
                        value: ((wins / eventsPlayed) * 100).toFixed(1) + ' %',
                        inline: true,
                    },
                    {
                        name: 'W - L',
                        value: `${wins} - ${losses}`,
                        inline: true,
                    },
                    {
                        name: '+ / -',
                        value: delta >= 0 ? `+${delta}` : delta.toString(),
                        inline: true,
                    },
                    {
                        name: 'Top Score',
                        value:
                            topScoreTableId === undefined
                                ? topScore.toString()
                                : `[${topScore}](https://mk8dx-lounge.com/TableDetails/${topScoreTableId})`,
                        inline: true,
                    },
                    {
                        name: 'Avg. Score',
                        value: (sumScore / eventsPlayed).toFixed(1),
                        inline: true,
                    },
                    {
                        name: 'Partner Avg.',
                        value: partnerCount === 0 ? '-' : (sumPartnerScore / partnerCount).toFixed(1),
                        inline: true,
                    },
                    {
                        name: 'Events Played',
                        value: eventsPlayed.toString(),
                        inline: true,
                    },
                    {
                        name: 'Largest Gain',
                        value:
                            largestGain === -1
                                ? '-'
                                : largestGainTableId === undefined
                                ? `+${largestGain}`
                                : `[+${largestGain}](https://mk8dx-lounge.com/TableDetails/${largestGainTableId})`,
                        inline: true,
                    },
                    {
                        name: 'Largest Loss',
                        value:
                            largestLoss === 0
                                ? '-'
                                : largestLossTableId === undefined
                                ? largestLoss.toString()
                                : `[${largestLoss}](https://mk8dx-lounge.com/TableDetails/${largestLossTableId})`,
                        inline: true,
                    },
                ],
            },
        ],
    }
}

const createFilteredMessage = (options: {
    playerDetails: Lounge.PlayerDetails
    tableDeleteIds: Set<number>
    tiers: string[]
    formats: number[]
    partnerIds: number[]
    slice?: { start?: number; end?: number }
}): MessageOptions => {
    const mmrChanges = options.playerDetails.mmrChanges
        .reverse()
        .filter((mmrChange) => {
            if (mmrChange.reason !== 'Table') return false
            if (options.tableDeleteIds.has(mmrChange.changeId!)) return false
            if (options.tiers.length && !options.tiers.includes(mmrChange.tier!.toUpperCase())) return false
            if (options.formats.length && !options.formats.includes(12 / mmrChange.numTeams!)) return false
            if (
                options.partnerIds.length &&
                !options.partnerIds.every((partnerId) => mmrChange.partnerIds?.includes(partnerId))
            )
                return false
            return true
        })
        .slice(options.slice?.start, options.slice?.end)
    let wins = 0
    let losses = 0
    let delta = 0
    let sumScore = 0
    let topScore = 0
    let topScoreTableId: number | undefined
    let sumPartnerScore = 0
    let partnerCount = 0
    let largestGain = -1
    let largestLoss = 0
    let largestGainTableId: number | undefined
    let largestLossTableId: number | undefined
    for (const mmrChange of mmrChanges) {
        delta += mmrChange.mmrDelta
        sumScore += mmrChange.score!
        if (mmrChange.score! > topScore) {
            topScore = mmrChange.score!
            topScoreTableId = mmrChange.changeId
        }
        sumPartnerScore += mmrChange.partnerScores?.reduce((a, b) => a + b, 0) ?? 0
        partnerCount += mmrChange.partnerScores?.length ?? 0
        if (mmrChange.mmrDelta >= 0) {
            wins++
            if (mmrChange.mmrDelta > largestGain) {
                largestGain = mmrChange.mmrDelta
                largestGainTableId = mmrChange.changeId
            }
        } else {
            losses++
            if (mmrChange.mmrDelta < largestLoss) {
                largestLoss = mmrChange.mmrDelta
                largestLossTableId = mmrChange.changeId
            }
        }
    }
    const eventsPlayed = wins + losses
    if (eventsPlayed === 0) {
        return createNotPlayedMessage(options.playerDetails)
    }
    const canvas = createCanvas(1280, 720)
    const chart = new Chart(
        // @ts-expect-error: invalid type
        canvas.getContext('2d'),
        Lounge.createDeltaChartConfig({
            season: options.playerDetails.season,
            data: mmrChanges,
            setBackground: true,
        }),
    )
    const image = canvas.toBuffer('image/png')
    chart.destroy()
    return {
        files: [
            {
                name: 'delta.png',
                attachment: image,
            },
        ],
        embeds: [
            {
                title: options.playerDetails.name,
                url: `https://mk8dx-lounge.com/PlayerDetails/${options.playerDetails.playerId}?season=${options.playerDetails.season}`,
                color:
                    options.playerDetails.mmr !== undefined
                        ? Lounge.Season.get(options.playerDetails.season).getDivision(options.playerDetails.mmr).color
                        : undefined,
                image: {
                    url: 'attachment://delta.png',
                    width: 1280,
                    height: 720,
                },
                fields: [
                    {
                        name: 'Win Rate',
                        value: ((wins / eventsPlayed) * 100).toFixed(1) + ' %',
                        inline: true,
                    },
                    {
                        name: 'W - L',
                        value: `${wins} - ${losses}`,
                        inline: true,
                    },
                    {
                        name: '+ / -',
                        value: delta >= 0 ? `+${delta}` : delta.toString(),
                        inline: true,
                    },
                    {
                        name: 'Top Score',
                        value:
                            topScoreTableId === undefined
                                ? topScore.toString()
                                : `[${topScore}](https://mk8dx-lounge.com/TableDetails/${topScoreTableId})`,
                        inline: true,
                    },
                    {
                        name: 'Avg. Score',
                        value: (sumScore / eventsPlayed).toFixed(1),
                        inline: true,
                    },
                    {
                        name: 'Partner Avg.',
                        value: partnerCount === 0 ? '-' : (sumPartnerScore / partnerCount).toFixed(1),
                        inline: true,
                    },
                    {
                        name: 'Events Played',
                        value: eventsPlayed.toString(),
                        inline: true,
                    },
                    {
                        name: 'Largest Gain',
                        value:
                            largestGain === -1
                                ? '-'
                                : largestGainTableId === undefined
                                ? `+${largestGain}`
                                : `[+${largestGain}](https://mk8dx-lounge.com/TableDetails/${largestGainTableId})`,
                        inline: true,
                    },
                    {
                        name: 'Largest Loss',
                        value:
                            largestLoss === 0
                                ? '-'
                                : largestLossTableId === undefined
                                ? largestLoss.toString()
                                : `[${largestLoss}](https://mk8dx-lounge.com/TableDetails/${largestLossTableId})`,
                        inline: true,
                    },
                ],
            },
        ],
    }
}

const createNotPlayedMessage = (playerDetails: Lounge.PlayerDetails): MessageOptions => {
    return {
        embeds: [
            {
                title: playerDetails.name,
                url: `https://mk8dx-lounge.com/PlayerDetails/${playerDetails.playerId}?season=${playerDetails.season}`,
                description: 'Not Played.',
                color: 0xff0000,
            },
        ],
        files: [],
    }
}
