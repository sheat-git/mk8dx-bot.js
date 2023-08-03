import { SlashCommandBuilder } from 'discord.js'
import { SlashHandler } from '@/interaction'

SlashHandler.default.register({
    builder: new SlashCommandBuilder().setName('sokuji').setDescription('Sokuji'),
})
