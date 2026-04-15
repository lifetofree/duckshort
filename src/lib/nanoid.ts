import { customAlphabet } from 'nanoid'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const nanoid = customAlphabet(BASE62, 8)

export function generateId(): string {
  return nanoid()
}