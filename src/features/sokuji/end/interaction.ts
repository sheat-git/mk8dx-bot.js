import { InteractionHandler } from '@/interaction'
import { Sokuji, sokujiLock } from '@/utilities'

InteractionHandler.button.register({
    commands: ['sokuji', 'resume'],
    handle: async (interaction, [id]) => {
        await interaction.update({ components: [] })
        await sokujiLock.acquire(interaction.channelId, async () => {
            const [prevSokuji, newSokuji] = await Promise.all([
                Sokuji.loadNow(interaction.channelId),
                Sokuji.loadById(id, true),
            ])
            if (prevSokuji) {
                prevSokuji.isEnded = true
                prevSokuji.editPrevMessage(interaction.client, { components: 'overwrite' })
                prevSokuji.deleteConfigMessage(interaction.client)
                prevSokuji.save(true).catch(() => {})
            }
            newSokuji.isEnded = false
            const [configMessage, sokujiMessage] = await Promise.all([
                interaction.followUp(await newSokuji.createConfigMessage()),
                interaction.followUp(await newSokuji.createMessage()),
            ])
            await newSokuji.save(
                {
                    configMessageId: configMessage.id,
                    messageId: sokujiMessage.id,
                },
                true,
            )
        })
    },
})
