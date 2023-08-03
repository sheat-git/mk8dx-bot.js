import { InteractionHandler } from '@/interaction'
import { Sokuji, sokujiLock } from '@/utilities'

InteractionHandler.button.register({
    commands: ['sokuji', 'resume'],
    handle: async (interaction, [id]) => {
        await interaction.update({ components: [] })
        await sokujiLock.acquire(interaction.channelId, async () => {
            const sokuji = await Sokuji.loadById(id, true)
            sokuji.isEnded = false
            const [configMessage, sokujiMessage] = await Promise.all([
                interaction.followUp(await sokuji.createConfigMessage()),
                interaction.followUp(await sokuji.createMessage()),
            ])
            await sokuji.save(
                {
                    configMessageId: configMessage.id,
                    messageId: sokujiMessage.id,
                },
                true,
            )
        })
    },
})
