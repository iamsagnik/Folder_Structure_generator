
function detectSnippet(raw) {
    const trimmed = raw.trim();
    const keywords = ["rafce", "rfc", "rafc", "rsc", "rcc"];

    if (keywords.includes(trimmed)) return trimmed;

    if (/export default\s+.*=>\s*\(/i.test(raw)) return "rafce";
    if (/export default function/i.test(raw)) return "rfc";
    if (/const\s+\w+\s*=\s*\(/i.test(raw) && /return\s*\(/i.test(raw)) return "rafc";

    return null;
}

module.exports = { 
  detectSnippet 
};