import { GlobalFonts } from '@napi-rs/canvas'

export const setupCanvas = () => {
    GlobalFonts.registerFromPath('./assets/fonts/Montserrat-Bold.ttf', 'Montserrat-Bold')
    GlobalFonts.registerFromPath('./assets/fonts/Montserrat-Regular.ttf', 'Montserrat-Regular')
    GlobalFonts.registerFromPath('./assets/fonts/NotoSansJP-Black.ttf', 'NotoSansJP-Black')
}
