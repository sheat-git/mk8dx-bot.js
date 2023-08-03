import { Vec3 } from 'node-vibrant/lib/color'

export const vec3ToNumber = (vec3: Vec3) => {
    const [r, g, b] = vec3
    return (r << 16) + (g << 8) + Math.floor(b)
}

export const numberToVec3 = (num: number): Vec3 => {
    const r = (num >> 16) & 0xff
    const g = (num >> 8) & 0xff
    const b = num & 0xff
    return [r, g, b]
}

export const numberToHex = (num: number) => '#' + num.toString(16).padStart(6, '0')
