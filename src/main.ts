import { ShardingManager } from 'discord.js'

const manager = new ShardingManager('./build/client.js', { totalShards: 2 })

manager.on('shardCreate', async (shard) => {
    console.log(`Launched shard ${shard.id}`)
})

manager.spawn()
