import { ApplicationCommandType, ComponentType, Interaction, InteractionType, Locale } from 'discord.js'
import { BotError, LocalizedBotError } from '@/utilities/error'
import { ApplicationHandler, InteractionHandler, SlashHandler } from './handler'

export const handleInteraction = async (interaction: Interaction) => {
    try {
        switch (interaction.type) {
            case InteractionType.ApplicationCommand:
                switch (interaction.commandType) {
                    case ApplicationCommandType.ChatInput:
                        if (await SlashHandler.default.handleCommand(interaction)) return
                        break
                    case ApplicationCommandType.User:
                        if (await ApplicationHandler.user.handle(interaction)) return
                        break
                    case ApplicationCommandType.Message:
                        if (await ApplicationHandler.message.handle(interaction)) return
                        break
                }
                break
            case InteractionType.MessageComponent:
                const command = interaction.customId.split('_')
                switch (interaction.componentType) {
                    case ComponentType.Button:
                        if (await InteractionHandler.button.handle(interaction, command)) return
                        break
                    case ComponentType.StringSelect:
                        if (await InteractionHandler.stringSelect.handle(interaction, command)) return
                        break
                    case ComponentType.UserSelect:
                        if (await InteractionHandler.userSelect.handle(interaction, command)) return
                        break
                    case ComponentType.RoleSelect:
                        if (await InteractionHandler.roleSelect.handle(interaction, command)) return
                        break
                    case ComponentType.MentionableSelect:
                        if (await InteractionHandler.mentionableSelect.handle(interaction, command)) return
                        break
                    case ComponentType.ChannelSelect:
                        if (await InteractionHandler.channelSelect.handle(interaction, command)) return
                        break
                }
                break
            case InteractionType.ApplicationCommandAutocomplete:
                await SlashHandler.default.handleAutocomplete(interaction)
                return
            case InteractionType.ModalSubmit:
                if (await InteractionHandler.modalSubmit.handle(interaction, interaction.customId.split('_'))) return
                break
        }
        console.error(`Unknown interaction: ${interaction}`)
    } catch (error) {
        if (interaction.isAutocomplete()) return
        const options = {
            ...(() => {
                if (error instanceof BotError) return error.options
                const isJa = interaction.locale === Locale.Japanese
                if (error instanceof LocalizedBotError) return error.getMessage(isJa ? 'ja' : 'en')
                return {
                    content: isJa ? '予期せぬエラーが発生しました。' : 'An unexpected error has occurred.',
                }
            })(),
            ephemeral: true,
        }
        if (!(error instanceof BotError || error instanceof LocalizedBotError))
            console.error(`Unexpected error when handling interaction (${interaction}): ${error}`)
        if (interaction.deferred || interaction.replied) await interaction.followUp(options)
        else await interaction.reply(options)
    }
}
