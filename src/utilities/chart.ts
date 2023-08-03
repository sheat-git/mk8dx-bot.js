import { Chart, registerables } from 'chart.js'

export const setupChart = () => {
    Chart.register(...registerables)
    Chart.defaults.animation = false
    Chart.defaults.responsive = false
    Chart.defaults.font.size = 32
    Chart.defaults.layout.padding = {
        top: 40,
        right: 60,
        bottom: 20,
        left: 40,
    }
    Chart.defaults.scale.grid.lineWidth = 3
}
