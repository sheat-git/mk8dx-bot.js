import { MessageOptions } from './message'

export class BotError extends Error {
    readonly options: MessageOptions

    constructor(options: MessageOptions) {
        super(options.content)
        this.options = options
    }
}

export class LocalizedBotError extends Error {
    readonly localizations: {
        en: MessageOptions
        ja?: MessageOptions
    }

    constructor(localizations: { en: MessageOptions; ja?: MessageOptions }) {
        super(localizations.en.content)
        this.localizations = localizations
    }

    getMessage(locale?: keyof typeof this.localizations) {
        const message = this.localizations[locale ?? 'en']
        return message ?? this.localizations.en
    }
}

export const createError = (options: MessageOptions, optionsJa?: MessageOptions) => {
    if (!optionsJa) return new BotError(options)
    return new LocalizedBotError({
        en: options,
        ja: optionsJa,
    })
}

export const createTextError = (content: string, contentJa?: string) =>
    createError({ content }, contentJa ? { content: contentJa } : undefined)
