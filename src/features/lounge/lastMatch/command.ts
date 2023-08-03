import { ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js'
import { LoungeService } from '@/services'
import { Command, Component, MessageOptions, calcTierIndex, extractUser, extractUsers } from '@/utilities'
import { createTableEmbed } from '../table'
import { Lounge } from 'mk8dx'

export class LastMatchCommand extends Command<{
    name?: string
    season?: number
    last?: number
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
            await createLastMatchMessage({
                playerId: player.id,
                dif: this.options.last ?? 0,
                season: this.options.season,
                tiers: this.options.tiers
                    ?.split(/,|\s/)
                    .map((tier) => tier.trim().toUpperCase())
                    .filter(Boolean),
                formats: this.options.formats
                    ?.split(/[^\d]/)
                    .map(Number)
                    .filter((format) => Number.isInteger(format)),
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

export const createLastMatchMessage = async (options: {
    playerId: number
    dif: number
    tableId?: number
    season?: number
    tiers?: string[]
    formats?: number[]
    partners?: {
        id: number
        name: string
        isActive: boolean
    }[]
    showEdit?: boolean
    showAll?: boolean
}): Promise<MessageOptions> => {
    const details = await LoungeService.getPlayerDetails({
        id: options.playerId,
        season: options.season,
    })
    const tables = (() => {
        const tableDeleteIds = new Set(
            details.mmrChanges.filter((c) => c.reason === 'TableDelete').map((c) => c.changeId!),
        )
        return details.mmrChanges.filter((c) => c.reason === 'Table' && !tableDeleteIds.has(c.changeId!))
    })()

    const tiersComponent = (() => {
        const tiers: Record<string, number> = Object.create(null)
        for (const mmrChange of tables) {
            if (mmrChange.tier) tiers[mmrChange.tier] = (tiers[mmrChange.tier] ?? 0) + 1
        }
        const tiersOptions = Object.entries(tiers)
            .sort((a, b) => {
                return calcTierIndex(a[0]) - calcTierIndex(b[0])
            })
            .map(([tier, eventsPlayed]) => ({
                label: tier,
                description: `${eventsPlayed} Tables`,
                value: tier,
                default: options.tiers?.includes(tier) ?? false,
            }))
            .slice(undefined, 25)
        if (options.tiers !== undefined) {
            options.tiers = tiersOptions.filter((option) => option.default).map((option) => option.value)
        }
        if (tiersOptions.length) {
            return {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.StringSelect,
                        custom_id: 'lounge_lastmatch_tiers',
                        placeholder: 'Tiers',
                        min_values: 0,
                        max_values: tiersOptions.length,
                        options: tiersOptions,
                    },
                ],
            } as Component
        }
    })()
    const formatsComponent = (() => {
        const formats: Record<number, number> = Object.create(null)
        for (const mmrChange of tables) {
            if (mmrChange.numTeams) {
                const format = 12 / mmrChange.numTeams
                formats[format] = (formats[format] ?? 0) + 1
            }
        }
        const formatsOptions = Object.entries(formats)
            .sort((a, b) => +a[0] - +b[0])
            .map(([format, eventsPlayed]) => ({
                label: +format === 1 ? 'FFA' : `${format}v${format}`,
                description: `${eventsPlayed} Tables`,
                value: format.toString(),
                default: options.formats?.includes(+format) ?? false,
            }))
            .slice(undefined, 25)
        if (options.formats !== undefined) {
            options.formats = formatsOptions.filter((option) => option.default).map((option) => Number(option.value))
        }
        if (formatsOptions.length) {
            return {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.StringSelect,
                        custom_id: 'lounge_lastmatch_formats',
                        placeholder: 'Formats',
                        min_values: 0,
                        max_values: formatsOptions.length,
                        options: formatsOptions,
                    },
                ],
            } as Component
        }
    })()

    const tableIds: number[] = (() => {
        const partnerIds = options.partners?.filter((p) => p.isActive).map((p) => p.id) ?? []
        return tables
            .filter((mmrChange) => {
                if (options.tiers?.length && !options.tiers.includes(mmrChange.tier!.toUpperCase())) return false
                if (options.formats?.length && !options.formats.includes(12 / mmrChange.numTeams!)) return false
                if (partnerIds.length && !partnerIds.every((partnerId) => mmrChange.partnerIds?.includes(partnerId)))
                    return false
                return true
            })
            .map((c) => c.changeId!)
    })()
    let i = options.dif
    if (options.tableId !== undefined) {
        const j = tableIds.indexOf(options.tableId)
        if (j !== -1) {
            i += j
        } else {
            const j = tableIds.findIndex((id) => id < options.tableId!)
            if (j !== -1) {
                i += i > 0 ? j : j + 1
            } else {
                i += tableIds.length
            }
        }
        if (options.dif < 0 && i < 0) i = 0
        else if (i >= tableIds.length) i = tableIds.length - 1
    } else {
        if (options.dif < 0 && i < 0) i += tableIds.length
        else if (i >= tableIds.length) i = tableIds.length - 1
    }
    const tableId = 0 <= i && i < tableIds.length ? tableIds[i] : undefined
    const embed =
        tableId !== undefined ? createTableEmbed(await LoungeService.getTable({ tableId })) : createEmptyEmbed()
    embed.setDescription(
        `[${details.name}](https://mk8dx-lounge.com/PlayerDetails/${details.playerId}?season=${details.season})`,
    )
    const components: Component[] = [
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    custom_id: 'lounge_lastmatch_oldest',
                    label: '<<',
                    style: ButtonStyle.Primary,
                },
                {
                    type: ComponentType.Button,
                    custom_id: 'lounge_lastmatch_prev',
                    label: '<',
                    style: ButtonStyle.Danger,
                },
                {
                    type: ComponentType.Button,
                    custom_id: '0',
                    label: tableId !== undefined ? `${tableIds.length - i}/${tableIds.length}` : '0/0',
                    style: ButtonStyle.Secondary,
                    disabled: true,
                },
                {
                    type: ComponentType.Button,
                    custom_id: 'lounge_lastmatch_next',
                    label: '>',
                    style: ButtonStyle.Success,
                },
                {
                    type: ComponentType.Button,
                    custom_id: 'lounge_lastmatch_latest',
                    label: '>>',
                    style: ButtonStyle.Primary,
                },
            ],
        },
    ]
    const showAll = options.showAll
        ? true
        : [options.season, options.tiers, options.formats, options.partners].filter((option) => option !== undefined)
              .length >= 3
    // season
    if (showAll || options.season !== undefined) {
        const minSeason = Math.max(details.season - 12, 4)
        const maxSeason = Math.min(details.season + 12, Math.max(Lounge.nowSeason, details.season))
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.StringSelect,
                    custom_id: 'lounge_lastmatch_season',
                    placeholder: 'Season',
                    options: [...Array(maxSeason - minSeason + 1)].map((_, i) => {
                        const season = i + minSeason
                        return {
                            label: `Season ${season}`,
                            value: season.toString(),
                            default: season == details.season,
                        }
                    }),
                },
            ],
        })
    }
    if (showAll || options.tiers !== undefined || options.formats !== undefined || options.partners !== undefined) {
        // tiers
        if (showAll || options.tiers !== undefined) {
            if (tiersComponent) components.push(tiersComponent)
        }
        // formats
        if (showAll || options.formats !== undefined) {
            if (formatsComponent) components.push(formatsComponent)
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
                    description: `${partners[partner.id]} Tables`,
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
                        custom_id: 'lounge_lastmatch_partners',
                        placeholder: 'Partners',
                        min_values: 0,
                        max_values: partnersOptions.length,
                        options: partnersOptions,
                    },
                ],
            })
        }
    }
    if (options.showEdit && components.length < 4) {
        components.push({
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    custom_id: 'lounge_lastmatch_edit',
                    label: components.length >= 2 ? 'Edit More' : 'Edit',
                    emoji: { name: '🔧' },
                    style: ButtonStyle.Primary,
                },
            ],
        })
    }
    return { embeds: [embed], components }
}

const createEmptyEmbed = () => new EmbedBuilder().setTitle('Table (Not Played)').setColor(0xff0000)
