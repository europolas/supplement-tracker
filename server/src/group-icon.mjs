/** Store bounded icon DATA only; the browser reconstructs a strict inert SVG
 * allowlist. Never insert this value into HTML or let it influence AI prompts. */
import {ApiError} from './security.mjs';
export function groupIcon(value){
 if(value===undefined)return undefined;if(value===null||value==='')return '';
 if(typeof value!=='string'||value.length>16000)throw new ApiError(400,'INVALID_GROUP_ICON');const s=value.trim();
 if(/^<i\s+class\s*=\s*["']bi\s+bi-[a-z0-9-]+["']\s*>\s*<\/i>$/i.test(s))return s;
 if(!/^<svg(?:\s|>)[\s\S]*<\/svg>$/i.test(s)||/<!|<\?|<\s*(?:script|foreignObject|image|use|style|animate|set|iframe)\b|\bon[a-z]+\s*=|\b(?:href|style)\s*=|url\s*\(/i.test(s))throw new ApiError(400,'INVALID_GROUP_ICON');return s;
}
