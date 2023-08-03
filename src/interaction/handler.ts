import {
    ApplicationCommandType,
    AutocompleteInteraction,
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    ClientApplication,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    MentionableSelectMenuInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
    SlashCommandSubcommandGroupBuilder,
    StringSelectMenuInteraction,
    UserContextMenuCommandInteraction,
    UserSelectMenuInteraction,
} from 'discord.js'

class RecordWith3Keys<V> {
    private readonly object: Record<string, Record<string, Record<string, V>>>

    constructor() {
        this.object = Object.create(null)
    }

    get(key1: string, key2: string, key3: string): V | undefined {
        return this.object[key1]?.[key2]?.[key3]
    }

    set(key1: string, key2: string, key3: string, value: V) {
        if (!this.object[key1]) this.object[key1] = Object.create(null)
        if (!this.object[key1][key2]) this.object[key1][key2] = Object.create(null)
        this.object[key1][key2][key3] = value
    }
}

type HandleApplication<Interaction> = (interaction: Interaction) => Promise<void>
type HandleCommand = HandleApplication<ChatInputCommandInteraction>
type HandleAutocomplete = (interaction: AutocompleteInteraction) => Promise<void>

export class SlashHandler {
    private _builders?: Map<
        string,
        {
            main: SlashCommandBuilder
            groups: Map<string, SlashCommandSubcommandGroupBuilder>
        }
    >
    private readonly handles: RecordWith3Keys<HandleCommand>
    private readonly autocompletes: RecordWith3Keys<HandleAutocomplete>

    private constructor() {
        this._builders = new Map()
        this.handles = new RecordWith3Keys()
        this.autocompletes = new RecordWith3Keys()
    }

    static readonly default = new SlashHandler()

    get builders() {
        if (!this._builders) throw new Error('The builders were deleted.')
        return this._builders
    }

    deleteBuilders() {
        delete this._builders
    }

    register(options: { builder: SlashCommandBuilder; handle?: HandleCommand; autocomplete?: HandleAutocomplete }) {
        this.builders.set(options.builder.name, {
            main: options.builder,
            groups: new Map(),
        })
        if (options.handle) this.handles.set(options.builder.name, '', '', options.handle)
        if (options.autocomplete) this.autocompletes.set(options.builder.name, '', '', options.autocomplete)
    }

    registerGroup(options: { parent: string; builder: SlashCommandSubcommandGroupBuilder }) {
        const parent = this.builders.get(options.parent)
        if (!parent) throw new Error('The parent command was not found.')
        parent.main.addSubcommandGroup(options.builder)
        parent.groups.set(options.builder.name, options.builder)
    }

    registerSub(options: {
        parent: string | [string, string]
        builder:
            | SlashCommandSubcommandBuilder
            | ((builder: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder)
        handle: HandleCommand
        autocomplete?: HandleAutocomplete
    }) {
        const parentNames = typeof options.parent === 'string' ? [options.parent] : options.parent
        const parent = this.builders.get(parentNames[0])
        const parentBuilder = parentNames.length === 1 ? parent?.main : parent?.groups.get(parentNames[1])
        if (!parentBuilder) throw new Error('The parent command was not found.')
        const builder =
            typeof options.builder === 'function'
                ? options.builder(new SlashCommandSubcommandBuilder())
                : options.builder
        parentBuilder.addSubcommand(builder)
        this.handles.set(parentNames[0], parentNames[1] ?? '', builder.name, options.handle)
        if (options.autocomplete)
            this.autocompletes.set(parentNames[0], parentNames[1] ?? '', builder.name, options.autocomplete)
    }

    async handleCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const handle = this.handles.get(
            interaction.commandName,
            interaction.options.getSubcommandGroup(false) ?? '',
            interaction.options.getSubcommand(false) ?? '',
        )
        if (handle) {
            await handle(interaction)
            return true
        }
        return false
    }

    async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const handle = this.autocompletes.get(
            interaction.commandName,
            interaction.options.getSubcommandGroup(false) ?? '',
            interaction.options.getSubcommand(false) ?? '',
        )
        if (handle) await handle(interaction)
    }
}

export class ApplicationHandler<Interaction extends ContextMenuCommandInteraction> {
    private _builders?: ContextMenuCommandBuilder[]
    private readonly handles: Record<string, HandleApplication<Interaction>>

    private constructor() {
        this._builders = []
        this.handles = Object.create(null)
    }

    static readonly user = new ApplicationHandler<UserContextMenuCommandInteraction>()
    static readonly message = new ApplicationHandler<MessageContextMenuCommandInteraction>()

    get builders() {
        if (!this._builders) throw new Error('The datas was deleted.')
        return this._builders
    }

    deleteBuilders() {
        delete this._builders
    }

    register(options: { builder: ContextMenuCommandBuilder; handle: HandleApplication<Interaction> }) {
        this.builders.push(options.builder)
        if (options.builder.name in this.handles)
            throw new Error(`The context menu command "${options.builder.name}" has bean registered.`)
        this.handles[options.builder.name] = options.handle
    }

    async handle(interaction: Interaction): Promise<boolean> {
        if (interaction.commandName in this.handles) {
            await this.handles[interaction.commandName](interaction)
            return true
        }
        return false
    }
}

export const setCommands = async (application: ClientApplication, keepBuilders = false) => {
    await application.commands.set([
        ...Array.from(SlashHandler.default.builders.values()).map((builder) => builder.main),
        ...ApplicationHandler.user.builders.map((builder) => builder.setType(ApplicationCommandType.User)),
        ...ApplicationHandler.message.builders.map((builder) => builder.setType(ApplicationCommandType.Message)),
    ])
    if (!keepBuilders) {
        SlashHandler.default.deleteBuilders()
        ApplicationHandler.user.deleteBuilders()
        ApplicationHandler.message.deleteBuilders()
    }
}

type HandleInteraction<Interaction> = (interaction: Interaction, args: string[]) => Promise<void>

export class InteractionHandler<Interaction> {
    private handlers?: Record<string, InteractionHandler<Interaction>>
    private defaultHandle?: HandleInteraction<Interaction>

    private constructor(defaultHandle?: HandleInteraction<Interaction>) {
        this.defaultHandle = defaultHandle
    }

    static readonly button = new InteractionHandler<ButtonInteraction>()
    static readonly stringSelect = new InteractionHandler<StringSelectMenuInteraction>()
    static readonly userSelect = new InteractionHandler<UserSelectMenuInteraction>()
    static readonly roleSelect = new InteractionHandler<RoleSelectMenuInteraction>()
    static readonly mentionableSelect = new InteractionHandler<MentionableSelectMenuInteraction>()
    static readonly channelSelect = new InteractionHandler<ChannelSelectMenuInteraction>()
    static readonly modalSubmit = new InteractionHandler<ModalSubmitInteraction>()

    register(options: { commands: [string, ...string[]]; handle: HandleInteraction<Interaction> }) {
        if (this.handlers === undefined) this.handlers = Object.create(null)
        const handlers = this.handlers!
        if (options.commands.length === 0) throw new Error('The command name is empty.')
        const command = options.commands[0]
        switch (options.commands.length) {
            case 1:
                if (command in handlers) {
                    if (handlers[command].defaultHandle)
                        throw new Error(`The command "${command}" has bean registered.`)
                    handlers[command].defaultHandle = options.handle
                } else {
                    handlers[command] = new InteractionHandler(options.handle)
                }
                return
            default:
                if (!(command in handlers)) {
                    handlers[command] = new InteractionHandler()
                }
                handlers[command].register({
                    commands: options.commands.slice(1) as [string, ...string[]],
                    handle: options.handle,
                })
                return
        }
    }

    async handle(interaction: Interaction, commands: string[]): Promise<boolean> {
        const handler = commands.length ? this.handlers?.[commands[0]] : undefined
        if (handler) {
            if (await handler.handle(interaction, commands.slice(1))) return true
        }
        if (this.defaultHandle) {
            await this.defaultHandle(interaction, commands)
            return true
        }
        return false
    }
}
