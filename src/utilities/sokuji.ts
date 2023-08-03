import { GuildService } from '@/services/guild'
import { SokujiConfigItem, SokujiConfigService, SokujiEntity, SokujiService } from '@/services/sokuji'
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    ComponentType,
    Guild,
    If,
    SnowflakeUtil,
} from 'discord.js'
import { MessageOptions } from './message'
import { createColoredEmbed } from '@/components/embed'
import AsyncLock from 'async-lock'
import { createTextError } from './error'
import { nanoid } from 'nanoid'
import { Track } from 'mk8dx'
import { LatestTrackService } from '@/services/track'
import { createCanvas } from '@napi-rs/canvas'
import { hslToRgb, rgbToHsl } from 'node-vibrant/lib/util'
import { Chart, ChartOptions } from 'chart.js'
import { numberToHex, numberToVec3, vec3ToNumber } from './color'

export const sokujiLock = new AsyncLock()

export class Sokuji<HasPrev extends boolean = boolean> {
    readonly id: string
    readonly guildId: string | null
    readonly channelId: string
    readonly configMessageId: string | null
    readonly prevMessageId: If<HasPrev, string, null>
    readonly format: number
    tags: string[]
    colors: number[]
    scores: number[]
    raceNum: number
    readonly races: SokujiRace[]
    pendingRaceMessageId: string | null
    pendingRace: SokujiRace | null
    readonly others: Record<
        number,
        {
            reason: string
            scores: number[]
        }[]
    >
    isJa: boolean
    showText: boolean
    showImage: boolean
    mode: 'classic' | 'compact'
    isEnded: boolean

    get teamNum() {
        return this.tags.length
    }

    get entries() {
        const entries: (
            | {
                  n: number
                  track: Track | null
                  scores: number[]
                  ranks: number[]
              }
            | {
                  reason: string
                  scores: number[]
              }
        )[] = this.races.map((r, i) => ({ n: i + 1, track: r.track, scores: r.scores, ranks: r.ranks }))
        for (const i of Object.keys(this.others)
            .map(Number)
            .sort((a, b) => b - a)) {
            entries.splice(i, 0, ...this.others[i])
        }
        return entries
    }

    get entriesLength() {
        return this.races.length + Object.values(this.others).reduce((a, b) => a + b.length, 0)
    }

    private constructor(
        options: Omit<SokujiEntity, 'messageId'> & {
            prevMessageId: If<HasPrev, string, null>
        } & Partial<SokujiConfigItem>,
    ) {
        this.id = options.id
        this.guildId = options.guildId
        this.channelId = options.channelId
        this.configMessageId = options.configMessageId
        this.prevMessageId = options.prevMessageId
        this.format = options.format
        this.tags = options.tags
        this.colors = options.colors
        this.scores = options.scores
        this.raceNum = options.raceNum
        this.races = SokujiRace.fromSokuji(options)
        this.pendingRaceMessageId = options.pendingRace?.messageId ?? null
        this.pendingRace = options.pendingRace
            ? new SokujiRace({
                  format: this.format,
                  track: options.pendingRace.trackId !== null ? Track.All[options.pendingRace.trackId] : null,
                  order: options.pendingRace.order,
              })
            : null
        this.others = options.others
        this.isJa = options.isJa ?? false
        this.showText = options.showText ?? false
        this.showImage = options.showImage ?? false
        this.mode = options.mode ?? 'classic'
        this.isEnded = options.isEnded ?? false
    }

    static async start(options: { guild: Guild | null; channelId: string; format?: number; tags?: string[] }) {
        const format =
            options.format ??
            (() => {
                switch (options.tags?.length) {
                    case 3:
                        return 4
                    case 4:
                        return 3
                    case 5:
                    case 6:
                        return 2
                    default:
                        return 6
                }
            })()
        const teamNum = 12 / format
        const tags = options.tags?.slice(0, teamNum).map((tag) => tag.slice(0, 10)) ?? []
        const guild = options.guild ? await GuildService.default.get(options.guild) : null
        if (tags.length < teamNum) {
            if (guild) tags.unshift(guild.tag)
            for (let i = 0; tags.length < teamNum; i++) {
                const tag = String.fromCharCode(65 + i).repeat(2)
                if (!tags.includes(tag)) tags.push(tag)
            }
        }
        const hues: number[] = []
        if (guild && tags[0] === guild.tag) hues.push(rgbToHsl(...numberToVec3(guild.color))[0])
        if (hues.length < teamNum) hues.push(...[...Array(teamNum - hues.length)].map((_, i, a) => i / a.length))
        const config = await SokujiConfigService.default.get(options.channelId)
        return new Sokuji<false>({
            id: nanoid(10),
            guildId: options.guild?.id ?? null,
            channelId: options.channelId,
            configMessageId: null,
            prevMessageId: null,
            format,
            tags,
            colors: hues.map((h) => hslToRgb(h, 0.8, 0.6)).map(vec3ToNumber),
            scores: Array(teamNum).fill(0),
            raceNum: 12,
            races: [],
            pendingRace: null,
            others: [],
            isJa: config?.isJa ?? guild?.isJa,
            showText: config?.showText,
            showImage: config?.showImage,
            mode: config?.mode,
            isEnded: false,
        })
    }

    static loadNow(channelId: string, force: true): Promise<Sokuji<true>>
    static loadNow(channelId: string, force?: false): Promise<Sokuji<true> | null>
    static async loadNow(channelId: string, force = false) {
        const [entity, config] = await Promise.all([
            SokujiService.default.getNow(channelId),
            SokujiConfigService.default.get(channelId),
        ])
        if (!entity) {
            if (force)
                throw createTextError(
                    'Sokuji is not found in this channel. Start sokuji again.',
                    'このチャンネルで即時集計が見つかりません。再度即時集計を開始してください。',
                )
            return null
        }
        return new Sokuji<true>({
            ...entity,
            ...config,
            prevMessageId: entity.messageId,
        })
    }

    static loadById(id: string, force: true): Promise<Sokuji<true>>
    static loadById(id: string, force?: false): Promise<Sokuji<true> | null>
    static async loadById(id: string, force = false) {
        const entity = await SokujiService.default.getById(id)
        if (!entity) {
            if (force) throw createTextError('Matching sokuji not found.', '該当する即時集計が見つかりません。')
            return null
        }
        const config = await SokujiConfigService.default.get(entity.channelId)
        return new Sokuji<true>({
            ...entity,
            ...config,
            prevMessageId: entity.messageId,
        })
    }

    save(usePrevMessageId: If<HasPrev, true, never>): Promise<void>
    save(messageId: string): Promise<void>
    save(options: { messageId: string; configMessageId: string | null }, updateChannel?: boolean): Promise<void>
    async save(options: { messageId: string; configMessageId: string | null } | string | true, updateChannel = false) {
        let configMessageId: string | null = this.configMessageId
        let messageId: string
        switch (typeof options) {
            case 'boolean':
                messageId = this.prevMessageId!
                break
            case 'string':
                messageId = options
                break
            case 'object':
                messageId = options.messageId
                configMessageId = options.configMessageId
                break
        }
        await Promise.all([
            SokujiService.default.put(
                {
                    id: this.id,
                    guildId: this.guildId,
                    channelId: this.channelId,
                    configMessageId,
                    messageId,
                    format: this.format,
                    tags: this.tags,
                    colors: this.colors,
                    scores: this.scores,
                    raceNum: this.raceNum,
                    races: this.races.map((race) => race.toEntity(true)),
                    pendingRace: null,
                    others: this.others,
                    isEnded: this.isEnded,
                },
                updateChannel,
            ),
            SokujiConfigService.default.put(this.channelId, {
                isJa: this.isJa,
                showText: this.showText,
                showImage: this.showImage,
                mode: this.mode,
            }),
        ])
    }

    async startNextRace() {
        this.pendingRace = new SokujiRace({
            track: await LatestTrackService.default.get(
                this.channelId,
                SnowflakeUtil.timestampFrom(this.prevMessageId!),
            ),
            format: this.format,
        })
        return this.pendingRace
    }

    async saveWithPendingRace(messageId: string) {
        await SokujiService.default.put({
            id: this.id,
            guildId: this.guildId,
            channelId: this.channelId,
            configMessageId: this.configMessageId,
            messageId: this.prevMessageId!,
            format: this.format,
            tags: this.tags,
            colors: this.colors,
            scores: this.scores,
            raceNum: this.raceNum,
            races: this.races.map((race) => race.toEntity(true)),
            pendingRace: this.pendingRace ? { ...this.pendingRace.toEntity(), messageId } : null,
            others: this.others,
            isEnded: this.isEnded,
        })
    }

    pushPendingRace() {
        if (!this.pendingRace) return
        this.races.push(this.pendingRace)
        for (let i = 0; i < this.scores.length; i++) this.scores[i] += this.pendingRace.scores[i]
        this.pendingRace = null
    }

    private createContent(): string {
        return this.showText
            ? this.scores
                  .map((score, i) => ({ score, i }))
                  .sort((a, b) => b.score - a.score)
                  .map(({ score, i }) => {
                      if (i === 0) return `${this.tags[0]}: ${score}`
                      const dif = this.scores[0] - score
                      return `${this.tags[i]}: ${score} (${dif >= 0 ? '+' : ''}${dif})`
                  })
                  .join(' | ') + ` || @${this.raceNum - this.races.length}`
            : ''
    }

    private async createEmbed() {
        const hideDif = this.format === 2
        const embed = (await createColoredEmbed(this.guildId))
            .setTitle(this.tags.join(' - '))
            .setDescription(
                '```ansi\n' +
                    scoresToAnsi(this.scores, { pad: 1, hideDif }) +
                    ` \u001b[34m@${this.raceNum - this.races.length}` +
                    '```',
            )
        switch (this.mode) {
            case 'classic':
                return embed.addFields(
                    this.races.map((race, i) => {
                        let name = `${i + 1}.`
                        if (race.track)
                            name += ` ${race.track.emoji} ${this.isJa ? race.track.abbrJa : race.track.abbr}`
                        return {
                            name,
                            value:
                                '```ansi\n' +
                                scoresToAnsi(race.scores, { hideDif }) +
                                ' | ' +
                                race.ranks.join(',') +
                                '```',
                        }
                    }),
                )
            case 'compact':
                const entries = this.entries
                if (!entries.length) return embed
                const entriesField = {
                    name: this.isJa ? 'スコア' : 'Scores',
                    value:
                        '```ansi\n' +
                        entries
                            .slice(-20)
                            .map((entry) => {
                                const ansiScores = scoresToAnsi(entry.scores, { hideDif: hideDif || this.format === 3 })
                                if (this.races.length === 0) {
                                    return ansiScores + ' | ' + (entry as { reason: string }).reason
                                }
                                const isRace = 'n' in entry
                                return (
                                    (isRace ? `${entry.n} | ` : '').padStart(this.races.length.toString().length + 3) +
                                    ansiScores +
                                    ' | ' +
                                    (isRace ? entry.ranks.join(',') : entry.reason)
                                )
                            })
                            .join('\n') +
                        '```',
                }
                if (entriesField.value.length > 1024) {
                    let value = entriesField.value.slice(8)
                    while (value.length > 1016) value = value.slice(value.indexOf('\n') + 1)
                    entriesField.value = '```ansi\n' + value
                }
                const tracks = this.races.slice(-24).map((race) => race.track)
                if (tracks.some((track) => track))
                    embed.addFields({
                        name: this.isJa ? 'コース' : 'Tracks',
                        value: [...Array(Math.ceil(tracks.length / 6))]
                            .map((_, i) =>
                                tracks
                                    .slice(i * 6, (i + 1) * 6)
                                    .map((track) => track?.emoji ?? '<:random:1135831412621189140>')
                                    .join(' '),
                            )
                            .join('\n'),
                    })
                return embed.addFields(entriesField)
        }
    }

    createImage(): Buffer | null {
        const withGraph = this.races.length === this.raceNum
        const formatIs6 = this.format === 6
        const canvas = createCanvas(1280, withGraph ? 720 : 400)
        const ctx = canvas.getContext('2d')
        // background
        const bgTileSize = 32
        const bgCanvas = createCanvas(bgTileSize * 2, bgTileSize * 2)
        const bgCtx = bgCanvas.getContext('2d')
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                bgCtx.fillStyle = i === j ? '#131313' : '#000000'
                bgCtx.fillRect(i * bgTileSize, j * bgTileSize, bgTileSize, bgTileSize)
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.fillStyle = ctx.createPattern(bgCanvas as any, 'repeat')
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        let teams = [...Array(this.teamNum)].map((_, i) => ({
            name: this.tags[i],
            color: this.colors[i],
            score: this.scores[i],
        }))
        if (!formatIs6) teams = teams.sort((a, b) => b.score - a.score)
        const teamWidth = 1200 / this.teamNum
        // names
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.font = '130px NotoSansJP-Black'
        for (let i = 0; i < this.teamNum; i++) {
            ctx.fillStyle = '#' + teams[i].color.toString(16).padStart(6, '0')
            ctx.fillText(teams[i].name, 40 + teamWidth * (i + 0.5), 170, teamWidth)
        }
        // scores
        ctx.fillStyle = '#ffffff'
        ctx.textBaseline = 'top'
        ctx.font = '140px Montserrat-Bold'
        for (let i = 0; i < this.teamNum; i++)
            ctx.fillText(teams[i].score.toString(), 40 + teamWidth * (i + 0.5), 170, teamWidth)
        // difs
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)'
        ctx.font = '70px Montserrat-Regular'
        if (formatIs6) {
            const dif = teams[0].score - teams[1].score
            ctx.fillText(dif >= 0 ? `+${dif}` : dif.toString(), 40 + teamWidth, 310, teamWidth)
        } else {
            for (let i = 1; i < this.teamNum; i++) {
                const dif = teams[i - 1].score - teams[i].score
                ctx.fillText(`±${dif}`, 40 + teamWidth * i, 310, teamWidth)
            }
        }
        // graph
        if (!withGraph) return canvas.toBuffer('image/png')
        const graphCanvas = createCanvas(1280, 320)
        const graphCtx = graphCanvas.getContext('2d')
        const options: ChartOptions<'line'> = {
            layout: {
                padding: {
                    top: 0,
                    bottom: 40,
                },
            },
            scales: {
                x: {
                    display: false,
                },
                y: {
                    ticks: {
                        color: 'rgba(235, 235, 245, 0.6)',
                        font: {
                            family: 'Montserrat-Regular',
                        },
                    },
                    grid: {
                        color: 'rgba(235, 235, 245, 0.6)',
                        tickLength: 0,
                    },
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
            },
        }
        let chart: Chart
        if (formatIs6) {
            const difs = this.entries
                .map((entry) => entry.scores[0] - entry.scores[1])
                .reduce(
                    (acc, cur) => {
                        acc.push(acc[acc.length - 1] + cur)
                        return acc
                    },
                    [0],
                )
            const min = Math.min(...difs),
                max = Math.max(...difs)
            options.scales!.y!.min = min
            options.scales!.y!.max = max
            const middle =
                max > 0 && min < 0 && Math.max(max, -min) / Math.min(max, -min) < 3 ? 0 : Math.floor((max + min) / 2)
            options.scales!.y!.ticks!.callback = (value) => {
                switch (value) {
                    case middle:
                    case min:
                    case max:
                        return value > 0 ? `+${value}` : value.toString()
                }
            }
            chart = new Chart(
                // @ts-expect-error: invalid type
                graphCtx,
                {
                    type: 'line',
                    data: {
                        labels: Array(difs.length).fill(''),
                        datasets: [
                            {
                                borderJoinStyle: 'round',
                                borderColor(ctx) {
                                    if (!ctx.chart.chartArea || difs.length <= 1) return null
                                    const colors = teams.map((team) => '#' + team.color.toString(16).padStart(6, '0'))
                                    const gradient = graphCtx.createLinearGradient(
                                        ctx.chart.chartArea.left,
                                        0,
                                        ctx.chart.chartArea.right,
                                        0,
                                    )
                                    let offset = 0
                                    const step = 1 / (difs.length - 1)
                                    const epsilon = 1 / 1200
                                    for (let i = 0; i < difs.length - 1; i++) {
                                        const prev = difs[i],
                                            next = difs[i + 1]
                                        if (prev >= 0 && next >= 0) {
                                            gradient.addColorStop(offset, colors[0])
                                            offset += step
                                            gradient.addColorStop(offset - epsilon, colors[0])
                                        } else if (prev <= 0 && next <= 0) {
                                            gradient.addColorStop(offset, colors[1])
                                            offset += step
                                            gradient.addColorStop(offset - epsilon, colors[1])
                                        } else {
                                            const prevColor = colors[prev > 0 ? 0 : 1],
                                                nextColor = colors[next > 0 ? 0 : 1],
                                                edgeOffset = offset + step * (prev / (prev - next))
                                            gradient.addColorStop(offset, prevColor)
                                            gradient.addColorStop(edgeOffset - epsilon, prevColor)
                                            gradient.addColorStop(edgeOffset, nextColor)
                                            offset += step
                                            gradient.addColorStop(offset - epsilon, nextColor)
                                        }
                                    }
                                    return gradient
                                },
                                pointStyle: false,
                                fill: {
                                    target: 'origin',
                                    above: `rgba(${numberToVec3(teams[0].color).join(',')}, 0.2)`,
                                    below: `rgba(${numberToVec3(teams[1].color).join(',')}, 0.2)`,
                                },
                                data: difs,
                            },
                        ],
                    },
                    options,
                },
            )
        } else {
            const raceAvg = 82 / this.teamNum
            const datas = this.entries
                .map((entry) => {
                    if ('reason' in entry) return entry.scores
                    return entry.scores.map((score) => score - raceAvg)
                })
                .reduce(
                    (acc, cur) => {
                        for (let i = 0; i < this.teamNum; i++) {
                            acc[i].push(acc[i][acc[i].length - 1] + cur[i])
                        }
                        return acc
                    },
                    [...Array(this.teamNum)].map(() => [0]),
                )
            const min = Math.min(...datas.flat()),
                max = Math.max(...datas.flat())
            options.scales!.y!.min = min
            options.scales!.y!.max = max
            options.scales!.y!.ticks!.callback = (value) => {
                let num
                switch (value) {
                    case 0:
                        return 'Avg.'
                    case min:
                        num = Math.floor(min)
                        break
                    case max:
                        num = Math.ceil(max)
                        break
                }
                if (num !== undefined) return num >= 0 ? `+${num}` : num.toString()
            }
            chart = new Chart(
                // @ts-expect-error: invalid type
                graphCtx,
                {
                    type: 'line',
                    data: {
                        labels: Array(datas[0].length).fill(''),
                        datasets: [...Array(this.teamNum)].map((_, i) => ({
                            borderJoinStyle: 'round',
                            borderColor: numberToHex(teams[i].color),
                            pointStyle: false,
                            data: datas[i],
                        })),
                    },
                    options,
                },
            )
        }
        ctx.drawImage(graphCanvas, 0, 400)
        const image = canvas.toBuffer('image/png')
        chart.destroy()
        return image
    }

    async createMessage(): Promise<MessageOptions> {
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
        if (!this.isEnded) {
            if (this.raceNum > this.races.length) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('sokuji_add')
                        .setLabel(this.isJa ? '追加' : 'Add')
                        .setStyle(ButtonStyle.Primary),
                )
            }
            switch (this.format) {
                case 6:
                    actionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId('sokuji_edit_race')
                            .setLabel(this.isJa ? '編集' : 'Edit')
                            .setStyle(ButtonStyle.Success),
                    )
                    break
                default:
                    actionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId('sokuji_edit_track')
                            .setLabel(this.isJa ? 'コースを編集' : 'Edit Track')
                            .setStyle(ButtonStyle.Success),
                    )
            }
            if (this.races.length) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('sokuji_undo')
                        .setLabel(this.isJa ? '1つ戻す' : 'Undo Last')
                        .setStyle(ButtonStyle.Danger),
                )
            }
        } else {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`sokuji_resume_${this.id}`)
                    .setLabel(this.isJa ? '再開' : 'Resume')
                    .setStyle(ButtonStyle.Secondary),
            )
        }
        const embed = await this.createEmbed()
        const image = this.showImage ? this.createImage() : null
        return {
            content: this.createContent(),
            embeds: [embed.setImage(image ? 'attachment://sokuji.png' : null)],
            files: image
                ? [
                      {
                          name: 'sokuji.png',
                          attachment: image,
                      },
                  ]
                : [],
            components: actionRow.components.length ? [actionRow] : [],
        }
    }

    async createConfigMessage(): Promise<MessageOptions> {
        return {
            embeds: [
                (await createColoredEmbed(this.guildId))
                    .setTitle(this.isJa ? '即時集計 設定' : 'Sokuji Options')
                    .addFields(
                        {
                            name: this.isJa ? '表示' : 'View',
                            value: this.isJa
                                ? '1. テキスト: コピペ用のテキストも送信します。\n' +
                                  '1. 画像: 配信ウィジェットと同様の画像も送信します。\n' +
                                  '1. モード:\n' +
                                  '  - **クラシック**: 従来の表示方法です。\n' +
                                  '  - **コンパクト**: 内容をコースとスコアに分けた、より簡潔な表示方法です。'
                                : '1. Text: Send a text for copy and paste.\n' +
                                  '1. Image: Send an image similar to the stream widget.\n' +
                                  '1. Mode:\n' +
                                  '  - **Classic**: The conventional mode.\n' +
                                  '  - **Compact**: A more concise mode that divides the content into tracks and scores.',
                            inline: false,
                        },
                        {
                            name: this.isJa ? '配信ウィジェット' : 'Stream Widget',
                            value:
                                (this.isJa
                                    ? `<#${this.channelId}> チャンネル用の配信ウィジェットURLは以下です。\nこれはこのチャンネルで即時集計を行う限り固定です。`
                                    : `The stream widget URL for <#${this.channelId}> is as follows.\nThis is fixed as long as you do sokuji in this channel.`) +
                                `\nhttps://mk8dx.pages.dev/sokuji?channel_id=${this.channelId}`,
                            inline: false,
                        },
                    ),
            ],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        this.isJa
                            ? {
                                  type: ComponentType.Button,
                                  customId: 'sokuji_config_lang_en',
                                  label: 'English',
                                  style: ButtonStyle.Primary,
                              }
                            : {
                                  type: ComponentType.Button,
                                  customId: 'sokuji_config_lang_ja',
                                  label: '日本語',
                                  style: ButtonStyle.Primary,
                              },
                        this.showText
                            ? {
                                  type: ComponentType.Button,
                                  customId: 'sokuji_config_text_hide',
                                  label: this.isJa ? 'テキスト非表示' : 'Hide Text',
                                  style: ButtonStyle.Primary,
                              }
                            : {
                                  type: ComponentType.Button,
                                  customId: 'sokuji_config_text_show',
                                  label: this.isJa ? 'テキスト表示' : 'Show Text',
                                  style: ButtonStyle.Primary,
                              },
                        this.showImage
                            ? {
                                  type: ComponentType.Button,
                                  customId: 'sokuji_config_image_hide',
                                  label: this.isJa ? '画像非表示' : 'Hide Image',
                                  style: ButtonStyle.Primary,
                              }
                            : {
                                  type: ComponentType.Button,
                                  customId: 'sokuji_config_image_show',
                                  label: this.isJa ? '画像表示' : 'Show Image',
                                  style: ButtonStyle.Primary,
                              },
                    ],
                },
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.StringSelect,
                            customId: 'sokuji_config_mode',
                            placeholder: this.isJa ? '表示モード' : 'Display Mode',
                            options: [
                                {
                                    label: this.isJa ? 'クラシック' : 'Classic',
                                    value: 'classic',
                                },
                                {
                                    label: this.isJa ? 'コンパクト' : 'Compact',
                                    value: 'compact',
                                },
                            ].map((option) => ({
                                ...option,
                                default: option.value === this.mode,
                            })),
                        },
                    ],
                },
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            customId: 'sokuji_config_widget',
                            label: this.isJa ? '配信ウィジェット' : 'Stream Widget',
                            style: ButtonStyle.Primary,
                        },
                        {
                            type: ComponentType.Button,
                            customId: 'sokuji_config_tags',
                            label: this.isJa ? 'タグ変更' : 'Edit Tags',
                            style: ButtonStyle.Success,
                        },
                        {
                            type: ComponentType.Button,
                            customId: 'sokuji_config_raceNum',
                            label: this.isJa ? 'レース数変更' : 'Edit Total Races',
                            style: ButtonStyle.Success,
                        },
                    ],
                },
            ],
        }
    }

    private async createRaceEmbed(option: number | true) {
        const pending = option === true
        const race = pending ? this.pendingRace! : this.races.at(option)!
        let title = `${(pending ? this.races.length : option >= 0 ? option : this.races.length + option) + 1}.`
        if (race.track) title += ` ${race.track.emoji} ${this.isJa ? race.track.abbrJa : race.track.abbr}`
        return (await createColoredEmbed(this.guildId)).setTitle(title).addFields(
            this.tags.map((tag, i) => {
                if (race.scores[i] === 0) {
                    return {
                        name: tag,
                        value: '```ansi\n\u001b[30m--```',
                    }
                }
                let value = '```ansi\n' + race.scores[i].toString().padStart(2)
                switch (i) {
                    case 0:
                        value += ' '.repeat(5)
                        break
                    default:
                        const score = race.scores[i]
                        const dif = race.scores[0] - score
                        value +=
                            '\u001b[30m(' +
                            (dif >= 0 ? '\u001b[32m+' : '\u001b[31m-') +
                            Math.abs(dif).toString().padStart(2) +
                            '\u001b[30m)'
                }
                const ranks = race.getRanks(i)
                if (ranks.length) value += ' \u001b[0m| ' + ranks.join(',')
                value += '```'
                return { name: tag, value }
            }),
        )
    }

    createRaceMessage(pending: true): Promise<MessageOptions>
    createRaceMessage(index: number): Promise<MessageOptions>
    async createRaceMessage(option: number | true) {
        return {
            embeds: [await this.createRaceEmbed(option)],
        }
    }

    async editPrevMessage(
        client: Client,
        options: { hideComponents?: boolean } = {
            hideComponents: false,
        },
    ) {
        if (!this.prevMessageId) return
        const message = await this.createMessage()
        if (options.hideComponents) message.components = []
        await client.editMessage(this.channelId, this.prevMessageId, message).catch(() => {})
    }

    async deletePrevMessage(client: Client) {
        if (this.prevMessageId) await client.deleteMessage(this.channelId, this.prevMessageId).catch(() => {})
    }

    async editConfigMessage(client: Client) {
        if (this.configMessageId)
            await client
                .editMessage(this.channelId, this.configMessageId, await this.createConfigMessage())
                .catch(() => {})
    }

    async deleteConfigMessage(client: Client) {
        if (this.configMessageId) await client.deleteMessage(this.channelId, this.configMessageId).catch(() => {})
    }

    async deletePendingRaceMessage(client: Client) {
        if (this.pendingRaceMessageId)
            await client.deleteMessage(this.channelId, this.pendingRaceMessageId).catch(() => {})
    }
}

const scoresToAnsi = (
    scores: number[],
    options?: {
        pad?: number
        hideDif?: boolean
    },
) => {
    const pad = options?.pad ?? 2
    if (options?.hideDif) return scores.map((score) => score.toString().padStart(pad)).join(':')
    return (
        '\u001b[0m' +
        `${scores[0].toString().padStart(pad)}:` +
        scores
            .slice(1)
            .map((score) => {
                const dif = scores[0] - score
                return (
                    score.toString().padStart(pad) +
                    '\u001b[30m(' +
                    (dif >= 0 ? '\u001b[32m+' : '\u001b[31m-') +
                    Math.abs(dif).toString().padStart(pad) +
                    '\u001b[30m)'
                )
            })
            .join('\u001b[0m:') +
        '\u001b[0m'
    )
}

class SokujiRace {
    readonly format: number
    track: Track | null
    private order: (number | null)[]
    private cache: Omit<SokujiEntity['races'][number], 'trackId'> | null

    get teamNum() {
        return 12 / this.format
    }

    get scores() {
        if (this.cache) return this.cache.scores
        const scores = [15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
        const result = [...Array(this.teamNum)].map(() => 0)
        for (let r = 0; r < 12; r++) {
            const i = this.order[r]
            if (i !== null) result[i] += scores[r]
        }
        return result
    }

    getRanks(i: number) {
        return this.order.map((j, r) => (j === i ? r + 1 : 0)).filter((t) => t)
    }

    get ranks() {
        if (this.cache) return this.cache.ranks
        return this.order.map((i, r) => (i === 0 ? r + 1 : 0)).filter((t) => t)
    }

    constructor(options: { format: number; track: Track | null; order?: (number | null)[] })
    constructor(options: { format: number; track: Track | null; cache?: SokujiRace['cache'] })
    constructor(options: {
        format: number
        track: Track | null
        order?: (number | null)[]
        cache?: SokujiRace['cache']
    }) {
        this.format = options.format
        this.track = options.track
        if (options.cache) {
            this.order = options.cache.order
            this.cache = options.cache
        } else {
            this.order = options.order ?? Array(12).fill(null)
            this.cache = null
        }
    }

    static fromEntity(format: number, entity: SokujiEntity['races'][number]) {
        const { trackId, ...cache } = entity
        return new SokujiRace({
            format,
            track: trackId !== null ? Track.All[trackId] : null,
            cache,
        })
    }

    static fromSokuji(sokuji: Pick<SokujiEntity, 'format' | 'races'>) {
        return sokuji.races.map((entity) => SokujiRace.fromEntity(sokuji.format, entity))
    }

    validateOrder() {
        if (this.cache) return
        const counts = [...Array(this.teamNum)].map(() => 0)
        const order = this.order
            .map((i) => {
                if (i === null) return null
                if (counts[i] === this.format) return null
                counts[i]++
                return i
            })
            .slice(0, 12)
        if (order.length < 12) order.push(...Array(12 - order.length).fill(null))
        for (let i = 0; i < this.teamNum; i++) {
            while (counts[i] < this.format) {
                const r = order.findLastIndex((i) => i === null)
                order[r] = i
                counts[i]++
            }
        }
        this.order = order
        this.cache = {
            scores: this.scores,
            ranks: this.ranks,
            order: order as number[],
        }
    }

    toEntity<V extends boolean = false>(validate?: V) {
        if (validate) this.validateOrder()
        return {
            trackId: this.track?.id ?? null,
            order: this.order as If<V, number[], (number | null)[]>,
            scores: this.scores,
            ranks: this.ranks,
        }
    }

    set(ranks: (string | null)[], overwrite = false) {
        this.cache = null
        if (overwrite)
            for (let i = 0; i < this.teamNum; i++)
                if (typeof ranks.at(i) === 'string')
                    while (this.order.includes(i)) this.order[this.order.indexOf(i)] = null
        let filled = 0
        const overwrited: boolean[] = Array(12).fill(false)
        for (let i = 0; i < this.teamNum; i++) {
            let text = ranks.at(i)
            if (text == null) {
                if (this.order.includes(i)) filled++
                continue
            }
            text = text
                .replace(/[＋ー０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
                .replace(/[^+\-0-9]/g, '')
                .slice(0, 9)
            const parsed: number[] = []
            const pushIfNotExists = (...ns: number[]) => {
                for (const n of ns) if (!parsed.includes(n)) parsed.push(n)
            }
            const shiftIfStartsWith = (s: string) => {
                if (text!.startsWith(s)) {
                    text = text!.slice(s.length)
                    return true
                }
                return false
            }
            while (text) {
                let nexts: number[] | undefined
                const startsWithDash = shiftIfStartsWith('-')
                if (startsWithDash) while (shiftIfStartsWith('-')) continue
                if (shiftIfStartsWith('0') || shiftIfStartsWith('10')) nexts = [10]
                else if (shiftIfStartsWith('110')) nexts = [1, 10]
                else if (shiftIfStartsWith('1112')) nexts = [11, 12]
                else if (shiftIfStartsWith('111')) nexts = [1, 11]
                else if (shiftIfStartsWith('112')) nexts = [1, 12]
                else if (shiftIfStartsWith('+') || shiftIfStartsWith('11')) nexts = [11]
                else if (shiftIfStartsWith('12')) nexts = parsed.length || startsWithDash ? [12] : [1, 2]
                else if (text) {
                    nexts = [parseInt(text[0])]
                    text = text.slice(1)
                }
                if (startsWithDash) {
                    if (!nexts) nexts = [12]
                    for (let n = (parsed.at(-1) ?? 0) + 1; n < nexts[0]; n++) pushIfNotExists(n)
                }
                pushIfNotExists(...nexts!)
            }
            let count = 0
            const isWrited = (r: number) => {
                if (overwrite) return overwrited[r]
                return this.order[r] !== null
            }
            const write = (r: number) => {
                if (overwrite) overwrited[r] = true
                this.order[r] = i
            }
            const findLastIndex = () => {
                if (overwrite) return overwrited.findLastIndex((i) => i === false)
                return this.order.findLastIndex((i) => i === null)
            }
            for (const n of parsed) {
                const r = n - 1
                if (isWrited(r)) continue
                write(r)
                if (++count === this.format) break
            }
            while (count < this.format) {
                const r = findLastIndex()
                write(r)
                count++
            }
            filled++
        }
        if (filled >= this.teamNum - 1 || overwrite) {
            this.validateOrder()
            return true
        }
        return false
    }

    add(ranks: string) {
        const filtered = this.order.filter((i) => i !== null) as number[]
        const filled = filtered.length ? Math.max(...filtered) + 1 : 0
        return this.set([...Array(filled).fill(null), ...ranks.split(/\s+/)])
    }
}
