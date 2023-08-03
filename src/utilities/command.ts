import {
    ChatInputCommandInteraction,
    GuildMember,
    InteractionResponse,
    Locale,
    Message,
    MessageContextMenuCommandInteraction,
    UserContextMenuCommandInteraction,
} from 'discord.js'
import { MessageOptions } from './message'

type CommandInteraction =
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction

export abstract class Command<Options extends Record<string, unknown> = Record<string, never>> {
    readonly data: CommandInteraction | Message
    readonly options: Options

    constructor(data: CommandInteraction | Message, options: Options extends Record<string, never> ? never : Options)
    constructor(data: Options extends Record<string, never> ? CommandInteraction | Message : never)
    constructor(data: CommandInteraction | Message, options = {}) {
        this.data = data
        this.options = { ...options } as Options
    }

    get user() {
        if (this.data instanceof Message) return this.data.author
        if (this.data.isUserContextMenuCommand()) return this.data.targetUser
        return this.data.user
    }

    get member() {
        if (this.data instanceof Message) return this.data.member
        if (this.data.isUserContextMenuCommand()) return this.data.targetMember
        return this.data.member
    }

    get memberDisplayName() {
        if (this.member instanceof GuildMember) return this.member.displayName
        if (this.member?.nick) return this.member.nick
        return this.user.username
    }

    get locale() {
        return this.data instanceof Message ? this.data.guild?.preferredLocale : this.data.locale
    }

    get isJa() {
        return this.locale === Locale.Japanese
    }

    async defer(ephemeral?: boolean) {
        if (this.data instanceof Message) return
        if (this.data.deferred) return
        await this.data.deferReply({ ephemeral })
    }

    reply(options: MessageOptions & { fetchReply: true }): Promise<Message>
    reply(options: MessageOptions & { fetchReply: false }): Promise<InteractionResponse | null>
    reply(options: MessageOptions): Promise<Message | InteractionResponse | null>
    async reply(options: MessageOptions) {
        if (this.data instanceof Message) {
            const sendRes = await this.data.channel.send(options)
            return options.fetchReply ? sendRes : null
        } else if (this.data.deferred || this.data.replied) {
            const replyRes = await this.data.followUp(options)
            return options.fetchReply ? replyRes : null
        } else {
            return await this.data.reply(options)
        }
    }

    abstract run(): Promise<void>
}
