import { Message } from 'discord.js'

type HandleMessage = (message: Message, command: string, arg: string) => Promise<void>

export class MessageHandler {
    readonly handles: Record<string, HandleMessage>
    readonly handlesWithIsCommand: {
        isCommand: (command: string) => boolean
        handle: HandleMessage
    }[]

    private constructor() {
        this.handles = Object.create(null)
        this.handlesWithIsCommand = []
    }

    static readonly withPrefix = new MessageHandler()

    register(options: {
        commands: string[]
        isCommand?: (command: string) => boolean
        handle: (message: Message, command: string, arg: string) => Promise<void>
    }) {
        for (const command of options.commands.map((command) => command.toLowerCase())) {
            if (command in this.handles) throw new Error(`The command "${command}" has been registered.`)
            this.handles[command] = options.handle
        }
        if (options.isCommand !== undefined) {
            this.handlesWithIsCommand.push({
                isCommand: options.isCommand,
                handle: options.handle,
            })
        }
    }

    async handle(message: Message, command: string, arg: string): Promise<boolean> {
        if (command in this.handles) {
            await this.handles[command](message, command, arg)
            return true
        }
        for (const { isCommand, handle } of this.handlesWithIsCommand) {
            if (isCommand(command)) {
                await handle(message, command, arg)
                return true
            }
        }
        return false
    }
}
